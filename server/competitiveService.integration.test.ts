import { describe, expect, it } from "vitest";
import { multiplayerResults, multiplayerRooms, playerProfiles, playerRatingEvents, roomPlayers } from "../drizzle/schema";
import { finalizeCompetitiveMatch } from "./competitiveService";

function createFakeDb() {
  const room = { id: "room_12345678", state: "round_complete", stateVersion: 4, topic: "A fair topic" };
  const members = [{ userId: 1, roomId: room.id, side: "pro" }, { userId: 2, roomId: room.id, side: "con" }];
  const profiles = [
    { userId: 1, handle: "Pro", isPublic: 1, rating: 1000, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, abandons: 0, peakRating: 1000 },
    { userId: 2, handle: "Con", isPublic: 1, rating: 1000, gamesPlayed: 0, wins: 0, losses: 0, draws: 0, abandons: 0, peakRating: 1000 },
  ];
  let result: any = null;
  const ratingEvents: any[] = [];
  const insertCounts = { results: 0, ratings: 0 };
  let profileReads = 0;
  let profileUpdates = 0;
  const tableRows = (table: any) => table === multiplayerRooms ? [room] : table === roomPlayers ? members : table === multiplayerResults ? (result ? [result] : []) : table === playerProfiles ? [profiles[profileReads++]] : profiles;
  const chain = (table: any) => {
    const query: any = {
      where: () => query,
      limit: async () => tableRows(table),
      then: (resolve: (value: any) => unknown) => Promise.resolve(table === playerRatingEvents ? ratingEvents : tableRows(table)).then(resolve),
    };
    return query;
  };
  const tx: any = {
    select: () => ({ from: (table: any) => chain(table) }),
    insert: (table: any) => ({ values: async (values: any) => {
      if (table === multiplayerResults) { insertCounts.results += 1; result = { id: 31, ...values }; }
      if (table === playerRatingEvents) { insertCounts.ratings += 1; ratingEvents.push({ id: ratingEvents.length + 1, ...values }); }
    } }),
    update: (table: any) => ({ set: (values: any) => ({ where: async () => {
      if (table === multiplayerRooms) Object.assign(room, values);
      if (table === playerProfiles) Object.assign(profiles[profileUpdates++]!, values);
    } }) }),
  };
  return { db: { transaction: (callback: (value: any) => unknown) => callback(tx) }, room, profiles, ratingEvents, insertCounts };
}

describe("competitive result persistence", () => {
  it("updates both players once and returns the existing result on retry", async () => {
    const fixture = createFakeDb();
    const input = { roomId: "room_12345678", requesterUserId: 1, winnerSide: "pro" as const, finalizationKey: "final-key-123" };
    const first = await finalizeCompetitiveMatch(fixture.db, input);
    const second = await finalizeCompetitiveMatch(fixture.db, input);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(fixture.insertCounts.results).toBe(1);
    expect(fixture.insertCounts.ratings).toBe(2);
    expect(fixture.profiles[0]).toMatchObject({ gamesPlayed: 1, wins: 1, rating: 1020 });
    expect(fixture.profiles[1]).toMatchObject({ gamesPlayed: 1, losses: 1, rating: 980 });
    expect(fixture.room.state).toBe("completed");
  });
});
