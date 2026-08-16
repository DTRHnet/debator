import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ENV } from "../_core/env";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { canHostCancel, getRoomForUser, enqueuePlayer, findAndClaimMatch, leaveQueue, nextRoomState, appendRoomEvent, submitTurnOnce, toRoomSnapshot } from "../multiplayerService";
import { multiplayerRulesetSchema } from "../../shared/multiplayer";
import { broadcastRoomEvent } from "../realtime";

const enabled = () => {
  if (!ENV.multiplayerEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Multiplayer is not enabled yet." });
};

const roomInput = z.object({ roomId: z.string().min(8).max(64) });

export const multiplayerRuntimeRouter = router({
  queueStatus: protectedProcedure.query(async ({ ctx }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const rows = await db.select().from((await import("../../drizzle/schema")).matchmakingQueue).where((await import("drizzle-orm")).eq((await import("../../drizzle/schema")).matchmakingQueue.userId, ctx.user.id)).limit(1);
    return rows[0] ? { status: rows[0].status, createdAt: rows[0].createdAt, expiresAt: rows[0].expiresAt } : { status: "idle" as const, createdAt: null, expiresAt: null };
  }),

  enqueue: protectedProcedure.input(z.object({ ruleset: multiplayerRulesetSchema, category: z.string().trim().max(64).nullable() })).mutation(async ({ ctx, input }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const rows = await enqueuePlayer(db, { userId: ctx.user.id, ruleset: input.ruleset, rating: 1000, category: input.category });
    const roomId = await findAndClaimMatch(db, ctx.user.id);
    return { queued: !roomId, roomId, entry: rows[0] ?? null };
  }),

  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    await leaveQueue(db, ctx.user.id);
    return { success: true };
  }),

  eventsSince: protectedProcedure.input(roomInput.extend({ lastEventId: z.number().int().nonnegative().default(0) })).query(async ({ ctx, input }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const result = await getRoomForUser(db, input.roomId, ctx.user.id);
    if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found or access denied." });
    const { getRoomEventsSince } = await import("../multiplayerService");
    const events = await getRoomEventsSince(db, input.roomId, input.lastEventId);
    return events.map((event: any) => ({ eventId: event.eventId, type: event.type, payload: JSON.parse(event.payloadJson), createdAt: event.createdAt }));
  }),

  room: protectedProcedure.input(roomInput).query(async ({ ctx, input }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const result = await getRoomForUser(db, input.roomId, ctx.user.id);
    if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found or access denied." });
    return toRoomSnapshot(result.room, result.players);
  }),

  ready: protectedProcedure.input(roomInput).mutation(async ({ ctx, input }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const result = await getRoomForUser(db, input.roomId, ctx.user.id);
    if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found or access denied." });
    await db.update((await import("../../drizzle/schema")).roomPlayers).set({ ready: 1, connected: 1 }).where((await import("drizzle-orm")).and((await import("drizzle-orm")).eq((await import("../../drizzle/schema")).roomPlayers.roomId, input.roomId), (await import("drizzle-orm")).eq((await import("../../drizzle/schema")).roomPlayers.userId, ctx.user.id)));
    const players = await db.select().from((await import("../../drizzle/schema")).roomPlayers).where((await import("drizzle-orm")).eq((await import("../../drizzle/schema")).roomPlayers.roomId, input.roomId));
    const transition = nextRoomState({ state: result.room.state, players: players.length, readyPlayers: players.filter((player: any) => player.ready === 1).length, activeSide: result.room.activeSide, command: "ready" });
    if (transition.state !== result.room.state) {
      await db.update((await import("../../drizzle/schema")).multiplayerRooms).set({ state: transition.state, activeSide: transition.activeSide, stateVersion: result.room.stateVersion + 1 }).where((await import("drizzle-orm")).eq((await import("../../drizzle/schema")).multiplayerRooms.id, input.roomId));
      const eventId = await appendRoomEvent(db, input.roomId, "countdown", { stateVersion: result.room.stateVersion + 1 });
      broadcastRoomEvent(input.roomId, { eventId, type: "countdown", payload: { stateVersion: result.room.stateVersion + 1 } });
    }
    const latest = await getRoomForUser(db, input.roomId, ctx.user.id);
    return latest ? toRoomSnapshot(latest.room, latest.players) : null;
  }),

  submitTurn: protectedProcedure.input(roomInput.extend({ round: z.number().int().min(1).max(3), side: z.enum(["pro", "con"]), transcript: z.string().trim().min(1).max(20_000), idempotencyKey: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const result = await getRoomForUser(db, input.roomId, ctx.user.id);
    if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found or access denied." });
    const player = result.players.find((candidate: any) => candidate.userId === ctx.user.id);
    if (!player || player.side !== input.side) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot submit for that side." });
    if (result.room.state !== "speaking" && result.room.state !== "turn_submitted") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This room is not accepting a turn." });
    const submission = await submitTurnOnce(db, { ...input, userId: ctx.user.id });
    if (!submission.duplicate) {
      const transition = nextRoomState({ state: result.room.state, players: result.players.length, readyPlayers: result.players.filter((candidate: any) => candidate.ready === 1).length, activeSide: result.room.activeSide, command: "submit_turn" });
      await db.update((await import("../../drizzle/schema")).multiplayerRooms).set({ state: transition.state, activeSide: transition.activeSide, stateVersion: result.room.stateVersion + 1 }).where((await import("drizzle-orm")).eq((await import("../../drizzle/schema")).multiplayerRooms.id, input.roomId));
      const eventId = await appendRoomEvent(db, input.roomId, "turn_submitted", { stateVersion: result.room.stateVersion + 1, round: input.round, side: input.side });
      broadcastRoomEvent(input.roomId, { eventId, type: "turn_submitted", payload: { stateVersion: result.room.stateVersion + 1, round: input.round, side: input.side } });
    }
    const latest = await getRoomForUser(db, input.roomId, ctx.user.id);
    return { duplicate: submission.duplicate, snapshot: latest ? toRoomSnapshot(latest.room, latest.players) : null };
  }),

  cancelRoom: protectedProcedure.input(roomInput).mutation(async ({ ctx, input }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const result = await getRoomForUser(db, input.roomId, ctx.user.id);
    if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found or access denied." });
    if (result.room.hostUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the room host can cancel this room." });
    if (!canHostCancel(result.room, ctx.user.id)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This room can no longer be cancelled." });
    await db.update((await import("../../drizzle/schema")).multiplayerRooms).set({ state: "cancelled", stateVersion: result.room.stateVersion + 1 }).where((await import("drizzle-orm")).eq((await import("../../drizzle/schema")).multiplayerRooms.id, input.roomId));
    const eventId = await appendRoomEvent(db, input.roomId, "cancelled", { userId: ctx.user.id, reason: "host_cancelled" });
    broadcastRoomEvent(input.roomId, { eventId, type: "cancelled", payload: { userId: ctx.user.id, reason: "host_cancelled" } });
    return { success: true, state: "cancelled" as const };
  }),

  leaveRoom: protectedProcedure.input(roomInput).mutation(async ({ ctx, input }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const result = await getRoomForUser(db, input.roomId, ctx.user.id);
    if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found or access denied." });
    const transition = nextRoomState({ state: result.room.state, players: result.players.length, readyPlayers: result.players.filter((player: any) => player.ready === 1).length, activeSide: result.room.activeSide, command: "leave_room" });
    await db.update((await import("../../drizzle/schema")).multiplayerRooms).set({ state: transition.state, stateVersion: result.room.stateVersion + 1 }).where((await import("drizzle-orm")).eq((await import("../../drizzle/schema")).multiplayerRooms.id, input.roomId));
    const eventId = await appendRoomEvent(db, input.roomId, transition.state, { userId: ctx.user.id });
    broadcastRoomEvent(input.roomId, { eventId, type: transition.state, payload: { userId: ctx.user.id } });
    return { success: true, state: transition.state };
  }),
});
