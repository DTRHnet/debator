import { and, asc, eq, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { matchmakingQueue, multiplayerRooms, roomEvents, roomPlayers, roomTurns } from "../drizzle/schema";
import type { MultiplayerClientCommand, MultiplayerRoomState, MultiplayerRoomSnapshot, MultiplayerRuleset } from "../shared/multiplayer";

export const MULTIPLAYER_QUEUE_TTL_MS = 90_000;

export function rulesetHash(ruleset: MultiplayerRuleset) {
  return Buffer.from(JSON.stringify(ruleset)).toString("base64url").slice(0, 64);
}

export function chooseSides(firstUserId: number, secondUserId: number) {
  return firstUserId < secondUserId
    ? [{ userId: firstUserId, side: "pro" as const }, { userId: secondUserId, side: "con" as const }]
    : [{ userId: firstUserId, side: "con" as const }, { userId: secondUserId, side: "pro" as const }];
}

export function nextRoomState(input: { state: MultiplayerRoomState; players: number; readyPlayers: number; activeSide: "pro" | "con" | null; command: MultiplayerClientCommand["type"] }): { state: MultiplayerRoomState; activeSide: "pro" | "con" | null } {
  const { state, players, readyPlayers, activeSide, command } = input;
  if (command === "leave_room") return { state: state === "waiting" || state === "ready" ? "cancelled" : "abandoned", activeSide };
  if (state === "waiting" && command === "ready" && players === 2 && readyPlayers === 2) return { state: "countdown", activeSide: null };
  if (state === "countdown") return { state: "speaking", activeSide: "pro" };
  if (state === "speaking" && command === "submit_turn") return { state: "turn_submitted", activeSide };
  if (state === "turn_submitted") return { state: activeSide === "pro" ? "speaking" : "round_complete", activeSide: activeSide === "pro" ? "con" : null };
  if (state === "round_complete") return { state: "judging", activeSide: null };
  return { state, activeSide };
}

export async function enqueuePlayer(db: any, input: { userId: number; ruleset: MultiplayerRuleset; rating: number; category: string | null }) {
  const expiresAt = new Date(Date.now() + MULTIPLAYER_QUEUE_TTL_MS);
  const entry = {
    userId: input.userId,
    rulesetJson: JSON.stringify(input.ruleset),
    rulesetHash: rulesetHash(input.ruleset),
    rating: input.rating,
    category: input.category,
    status: "queued" as const,
    expiresAt,
  };
  await db.insert(matchmakingQueue).values(entry).onDuplicateKeyUpdate({ set: { ...entry, createdAt: new Date() } });
  return db.select().from(matchmakingQueue).where(eq(matchmakingQueue.userId, input.userId)).limit(1);
}

export async function leaveQueue(db: any, userId: number) {
  await db.update(matchmakingQueue).set({ status: "cancelled" }).where(and(eq(matchmakingQueue.userId, userId), eq(matchmakingQueue.status, "queued")));
}

export async function findAndClaimMatch(db: any, userId: number) {
  const own = await db.select().from(matchmakingQueue).where(and(eq(matchmakingQueue.userId, userId), eq(matchmakingQueue.status, "queued"))).limit(1);
  const candidate = own[0];
  if (!candidate) return null;
  const candidates = await db.select().from(matchmakingQueue).where(and(eq(matchmakingQueue.status, "queued"), eq(matchmakingQueue.rulesetHash, candidate.rulesetHash))).orderBy(asc(matchmakingQueue.createdAt));
  const opponent = candidates.find((row: typeof candidate) => row.userId !== userId && Math.abs(row.rating - candidate.rating) <= 100);
  if (!opponent) return null;
  const roomId = `room_${nanoid(20)}`;
  const sides = chooseSides(candidate.userId, opponent.userId);
  await db.insert(multiplayerRooms).values({ id: roomId, hostUserId: candidate.userId, topic: "A new DebateRush motion", rulesetJson: candidate.rulesetJson, state: "waiting", stateVersion: 0, currentRound: 1, activeSide: null, deadlineAt: null });
  await db.insert(roomPlayers).values(sides.map(player => ({ roomId, userId: player.userId, side: player.side, ready: 0, connected: 0 })));
  await db.update(matchmakingQueue).set({ status: "matched" }).where(and(eq(matchmakingQueue.userId, candidate.userId), eq(matchmakingQueue.status, "queued")));
  await db.update(matchmakingQueue).set({ status: "matched" }).where(and(eq(matchmakingQueue.userId, opponent.userId), eq(matchmakingQueue.status, "queued")));
  return roomId;
}

export async function getRoomForUser(db: any, roomId: string, userId: number) {
  const memberships = await db.select().from(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, userId))).limit(1);
  if (!memberships[0]) return null;
  const rooms = await db.select().from(multiplayerRooms).where(eq(multiplayerRooms.id, roomId)).limit(1);
  if (!rooms[0]) return null;
  const players = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, roomId));
  const events = await db.select().from(roomEvents).where(eq(roomEvents.roomId, roomId)).orderBy(asc(roomEvents.eventId));
  const latestEvent = events.at(-1);
  const recovery = reconcileRoomState({
    persistedState: rooms[0].state,
    persistedVersion: rooms[0].stateVersion,
    latestEvent: latestEvent ? { type: latestEvent.type, eventId: latestEvent.eventId } : undefined,
  });
  const room = recovery.recovered
    ? { ...rooms[0], state: recovery.state, stateVersion: recovery.stateVersion }
    : rooms[0];
  return { room, players, recovery };
}

export async function appendRoomEvent(db: any, roomId: string, type: string, payload: unknown) {
  const existing = await db.select().from(roomEvents).where(eq(roomEvents.roomId, roomId)).orderBy(asc(roomEvents.eventId));
  const eventId = existing.length ? existing[existing.length - 1].eventId + 1 : 1;
  await db.insert(roomEvents).values({ roomId, eventId, type, payloadJson: JSON.stringify(payload) });
  return eventId;
}

export async function submitTurnOnce(db: any, input: { roomId: string; userId: number; round: number; side: "pro" | "con"; transcript: string; idempotencyKey: string }) {
  const existing = await db.select().from(roomTurns).where(eq(roomTurns.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existing[0]) return { duplicate: true, turn: existing[0] };
  const turn = { roomId: input.roomId, userId: input.userId, round: input.round, side: input.side, transcript: input.transcript.trim().slice(0, 20_000), idempotencyKey: input.idempotencyKey };
  await db.insert(roomTurns).values(turn);
  return { duplicate: false, turn };
}

export function toRoomSnapshot(room: any, players: any[]): MultiplayerRoomSnapshot {
  const ruleset = JSON.parse(room.rulesetJson) as MultiplayerRuleset;
  return {
    roomId: room.id,
    state: room.state,
    stateVersion: room.stateVersion,
    serverNow: Date.now(),
    topic: room.topic,
    ruleset,
    round: room.currentRound,
    activeSide: room.activeSide,
    players: players.map(player => ({ userId: player.userId, handle: `Player ${player.userId}`, side: player.side, connected: player.connected === 1, ready: player.ready === 1 })),
    deadlineAt: room.deadlineAt ? new Date(room.deadlineAt).getTime() : null,
  };
}


export async function getRoomEventsSince(db: any, roomId: string, lastEventId: number) {
  return db.select().from(roomEvents).where(and(eq(roomEvents.roomId, roomId), gt(roomEvents.eventId, lastEventId))).orderBy(asc(roomEvents.eventId));
}


export function canHostCancel(room: { hostUserId: number; state: MultiplayerRoomState }, userId: number) {
  return room.hostUserId === userId && ["waiting", "ready", "countdown"].includes(room.state);
}

export function reconcileRoomState(input: { persistedState: MultiplayerRoomState; persistedVersion: number; latestEvent?: { type: string; eventId: number } }) {
  if (!input.latestEvent || input.latestEvent.eventId <= input.persistedVersion) {
    return { state: input.persistedState, stateVersion: input.persistedVersion, recovered: false };
  }
  const eventState = input.latestEvent.type as MultiplayerRoomState;
  const knownStates: MultiplayerRoomState[] = ["waiting", "ready", "countdown", "speaking", "turn_submitted", "round_complete", "judging", "completed", "abandoned", "expired", "cancelled"];
  return knownStates.includes(eventState)
    ? { state: eventState, stateVersion: input.latestEvent.eventId, recovered: true }
    : { state: input.persistedState, stateVersion: input.persistedVersion, recovered: false };
}
