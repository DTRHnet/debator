import { describe, expect, it } from "vitest";
import { calculateElo, leaderboardRankedRows, outcomeForSide } from "./competitiveService";

describe("competitiveService", () => {
  it("gives an equal-rated decisive win a positive provisional delta", () => {
    const result = calculateElo({ rating: 1000, opponentRating: 1000, score: 1, gamesPlayed: 0 });
    expect(result.priorRating).toBe(1000);
    expect(result.delta).toBe(20);
    expect(result.newRating).toBe(1020);
  });

  it("maps draw and abandonment outcomes without declaring a winner", () => {
    expect(outcomeForSide("draw", "pro")).toEqual({ outcome: "draw", score: 0.5 });
    expect(outcomeForSide("abandoned", "con")).toEqual({ outcome: "abandonment", score: 0.5 });
    expect(outcomeForSide("pro", "pro")).toEqual({ outcome: "win", score: 1 });
    expect(outcomeForSide("pro", "con")).toEqual({ outcome: "loss", score: 0 });
  });

  it("assigns stable one-based ranks to already ordered public rows", () => {
    expect(leaderboardRankedRows([
      { userId: 4, handle: "Alpha", rating: 1200, gamesPlayed: 3, wins: 2, losses: 1, draws: 0, peakRating: 1200 },
      { userId: 9, handle: "Beta", rating: 1180, gamesPlayed: 2, wins: 1, losses: 1, draws: 0, peakRating: 1180 },
    ], 10).map(row => [row.rank, row.handle])).toEqual([[11, "Alpha"], [12, "Beta"]]);
  });
});
