import { and, asc, desc, eq, gte } from "drizzle-orm";
import { multiplayerResults, multiplayerRooms, playerProfiles, playerRatingEvents, roomPlayers } from "../drizzle/schema";
import type { MultiplayerRoomState } from "../shared/multiplayer";

export type CompetitiveOutcome = "pro" | "con" | "draw" | "abandoned" | "server_fault";

export function calculateElo(input: { rating: number; opponentRating: number; score: 0 | 0.5 | 1; gamesPlayed: number }) {
  const expected = 1 / (1 + 10 ** ((input.opponentRating - input.rating) / 400));
  const kFactor = input.gamesPlayed < 10 ? 40 : 24;
  const delta = Math.round(kFactor * (input.score - expected));
  return { priorRating: input.rating, delta, newRating: Math.max(100, input.rating + delta), expected };
}

export function outcomeForSide(winnerSide: CompetitiveOutcome, side: "pro" | "con") {
  if (winnerSide === "draw") return { outcome: "draw" as const, score: 0.5 as const };
  if (winnerSide === "abandoned" || winnerSide === "server_fault") return { outcome: "abandonment" as const, score: 0.5 as const };
  const won = winnerSide === side;
  return { outcome: won ? "win" as const : "loss" as const, score: won ? 1 as const : 0 as const };
}

export function leaderboardRankedRows(rows: Array<{ userId: number; handle: string; rating: number; gamesPlayed: number; wins: number; losses: number; draws: number; peakRating: number }>, offset: number) {
  return rows.map((row, index) => ({ rank: offset + index + 1, ...row }));
}

async function ensureProfile(tx: any, userId: number) {
  const existing = await tx.select().from(playerProfiles).where(eq(playerProfiles.userId, userId)).limit(1);
  if (existing[0]) return existing[0];
  await tx.insert(playerProfiles).values({ userId, handle: `Player-${userId}`, isPublic: 1, preferredCategory: null });
  const created = await tx.select().from(playerProfiles).where(eq(playerProfiles.userId, userId)).limit(1);
  if (!created[0]) throw new Error("Could not create competitive player profile.");
  return created[0];
}

export async function finalizeCompetitiveMatch(db: any, input: { roomId: string; requesterUserId: number; winnerSide: CompetitiveOutcome; finalizationKey: string; reason?: string; aiAnalysisJson?: string | null }) {
  const run = async (tx: any) => {
    const roomRows = await tx.select().from(multiplayerRooms).where(eq(multiplayerRooms.id, input.roomId)).limit(1);
    const room = roomRows[0];
    if (!room) throw new Error("Room not found.");
    const members = await tx.select().from(roomPlayers).where(eq(roomPlayers.roomId, input.roomId));
    const requester = members.find((player: any) => player.userId === input.requesterUserId);
    if (!requester) throw new Error("Room access denied.");
    const existingRows = await tx.select().from(multiplayerResults).where(eq(multiplayerResults.roomId, input.roomId)).limit(1);
    if (existingRows[0]) return { duplicate: true, result: existingRows[0] };
    const allowedStates: MultiplayerRoomState[] = ["judging", "round_complete", "abandoned", "completed"];
    if (!allowedStates.includes(room.state)) throw new Error("Room is not ready to finalize.");
    const players = (await Promise.all(members.map((player: any) => ensureProfile(tx, player.userId)))).map((profile: any) => ({ ...profile }));
    const byUserId = new Map(players.map((profile: any) => [profile.userId, profile]));
    const winningUser = members.find((player: any) => player.side === input.winnerSide);
    const finalizationKey = input.finalizationKey.trim();
    await tx.insert(multiplayerResults).values({
      roomId: input.roomId,
      winnerSide: input.winnerSide,
      winningUserId: winningUser?.userId ?? null,
      finalizationKey,
      reason: input.reason ?? "completed",
      aiAnalysisJson: input.aiAnalysisJson ?? null,
    });
    const resultRows = await tx.select().from(multiplayerResults).where(eq(multiplayerResults.roomId, input.roomId)).limit(1);
    const result = resultRows[0];
    if (!result) throw new Error("Result could not be persisted.");
    const ratings = [];
    for (const member of members) {
      const profile = byUserId.get(member.userId);
      const opponent = members.find((candidate: any) => candidate.userId !== member.userId);
      const opponentProfile = opponent ? byUserId.get(opponent.userId) : profile;
      const outcome = outcomeForSide(input.winnerSide, member.side);
      const rating = calculateElo({ rating: profile.rating, opponentRating: opponentProfile?.rating ?? 1000, score: outcome.score, gamesPlayed: profile.gamesPlayed });
      const stats = {
        rating: rating.newRating,
        gamesPlayed: profile.gamesPlayed + 1,
        wins: profile.wins + (outcome.outcome === "win" ? 1 : 0),
        losses: profile.losses + (outcome.outcome === "loss" ? 1 : 0),
        draws: profile.draws + (outcome.outcome === "draw" ? 1 : 0),
        abandons: profile.abandons + (outcome.outcome === "abandonment" ? 1 : 0),
        peakRating: Math.max(profile.peakRating, rating.newRating),
      };
      await tx.insert(playerRatingEvents).values({
        resultId: result.id,
        roomId: input.roomId,
        userId: member.userId,
        opponentUserId: opponent?.userId ?? null,
        priorRating: rating.priorRating,
        newRating: rating.newRating,
        delta: rating.delta,
        outcome: outcome.outcome,
        idempotencyKey: `${finalizationKey}:${member.userId}`,
      });
      await tx.update(playerProfiles).set(stats).where(eq(playerProfiles.userId, member.userId));
      ratings.push({ userId: member.userId, ...rating, outcome: outcome.outcome });
    }
    await tx.update(multiplayerRooms).set({ state: "completed", activeSide: null, stateVersion: room.stateVersion + 1 }).where(eq(multiplayerRooms.id, input.roomId));
    return { duplicate: false, result, ratings };
  };
  if (typeof db.transaction === "function") return db.transaction(run);
  return run(db);
}

export async function getCompetitiveResult(db: any, roomId: string, userId: number) {
  const membership = await db.select().from(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, userId))).limit(1);
  if (!membership[0]) throw new Error("Room access denied.");
  const results = await db.select().from(multiplayerResults).where(eq(multiplayerResults.roomId, roomId)).limit(1);
  if (!results[0]) return null;
  const ratings = await db.select().from(playerRatingEvents).where(eq(playerRatingEvents.resultId, results[0].id)).orderBy(asc(playerRatingEvents.userId));
  return { result: results[0], ratings };
}

export async function getLeaderboard(db: any, input: { offset: number; limit: number; minimumGames: number }) {
  const rows = await db.select({ userId: playerProfiles.userId, handle: playerProfiles.handle, rating: playerProfiles.rating, gamesPlayed: playerProfiles.gamesPlayed, wins: playerProfiles.wins, losses: playerProfiles.losses, draws: playerProfiles.draws, peakRating: playerProfiles.peakRating })
    .from(playerProfiles)
    .where(and(eq(playerProfiles.isPublic, 1), gte(playerProfiles.gamesPlayed, input.minimumGames)))
    .orderBy(desc(playerProfiles.rating), desc(playerProfiles.gamesPlayed), asc(playerProfiles.handle))
    .limit(input.limit)
    .offset(input.offset);
  return leaderboardRankedRows(rows, input.offset);
}
