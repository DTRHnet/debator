import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getUserSettings } from "../db";
import { decryptSecret } from "../crypto";
import { judgeDebate } from "../debateJudge";
import { DEFAULT_FREE_MODEL } from "../../shared/freeModels";
import { appendRoomEvent } from "../multiplayerService";
import { broadcastRoomEvent } from "../realtime";
import { finalizeCompetitiveMatch, getCompetitiveResult, getLeaderboard } from "../competitiveService";
import { playerProfiles, roomPlayers, roomTurns } from "../../drizzle/schema";
import { asc, eq } from "drizzle-orm";

const enabled = () => {
  if (!ENV.multiplayerEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Multiplayer is not enabled yet." });
};

export const competitiveRouter = router({
  judge: protectedProcedure.input(z.object({ roomId: z.string().min(8).max(64), finalizationKey: z.string().trim().min(8).max(96) })).mutation(async ({ ctx, input }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const membership = await db.select().from(roomPlayers).where(eq(roomPlayers.roomId, input.roomId));
    if (!membership.some(player => player.userId === ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "Room access denied." });
    const turns = await db.select().from(roomTurns).where(eq(roomTurns.roomId, input.roomId)).orderBy(asc(roomTurns.createdAt));
    const settings = await getUserSettings(ctx.user.id);
    const apiKey = settings?.encryptedOpenRouterKey ? decryptSecret(settings.encryptedOpenRouterKey) : process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { status: "unavailable" as const, message: "AI judging is not configured for this match." };
    const proTranscript = turns.filter(turn => turn.side === "pro").map(turn => turn.transcript).join("\n\n");
    const conTranscript = turns.filter(turn => turn.side === "con").map(turn => turn.transcript).join("\n\n");
    const room = await db.select().from((await import("../../drizzle/schema")).multiplayerRooms).where(eq((await import("../../drizzle/schema")).multiplayerRooms.id, input.roomId)).limit(1);
    if (!room[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found." });
    try {
      const verdict = await judgeDebate({ apiKey, topic: room[0].topic, proTranscript, conTranscript, model: settings?.preferredModel ?? DEFAULT_FREE_MODEL });
      const finalized = await finalizeCompetitiveMatch(db, { roomId: input.roomId, requesterUserId: ctx.user.id, winnerSide: verdict.winner, finalizationKey: input.finalizationKey, reason: "ai_judged", aiAnalysisJson: JSON.stringify(verdict) });
      if (!finalized.duplicate) {
        const eventId = await appendRoomEvent(db, input.roomId, "completed", { resultId: finalized.result.id });
        broadcastRoomEvent(input.roomId, { eventId, type: "completed", payload: { resultId: finalized.result.id } });
      }
      return { status: "complete" as const, verdict, finalized };
    } catch (error) {
      throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "AI evaluation failed." });
    }
  }),

  result: protectedProcedure.input(z.object({ roomId: z.string().min(8).max(64) })).query(async ({ ctx, input }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    try {
      return getCompetitiveResult(db, input.roomId, ctx.user.id);
    } catch (error) {
      throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Room access denied." });
    }
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const rows = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, ctx.user.id)).limit(1);
    const profile = rows[0];
    return profile ? {
      userId: profile.userId,
      handle: profile.handle,
      isPublic: profile.isPublic === 1,
      rating: profile.rating,
      gamesPlayed: profile.gamesPlayed,
      wins: profile.wins,
      losses: profile.losses,
      draws: profile.draws,
      abandons: profile.abandons,
      peakRating: profile.peakRating,
    } : null;
  }),

  leaderboard: protectedProcedure.input(z.object({ offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(50).default(25), minimumGames: z.number().int().min(1).max(100).default(1) })).query(async ({ ctx, input }) => {
    enabled();
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
    const rows = await getLeaderboard(db, input);
    return { rows, offset: input.offset, limit: input.limit, minimumGames: input.minimumGames, viewerUserId: ctx.user.id };
  }),
});
