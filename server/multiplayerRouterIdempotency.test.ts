import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";
import { matchmakingQueue, multiplayerRooms, roomEvents, roomPlayers, roomTurns } from "../drizzle/schema";

const getDbMock = vi.hoisted(() => vi.fn());
vi.mock("./db", () => ({ getDb: getDbMock }));

const user = { id: 7, openId: "router-user", email: "router@example.com", name: "Router User", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const context = { user, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

function createFakeDb() {
  const turns: any[] = [];
  const updates: any[] = [];
  const room = { id: "room_router_test", hostUserId: 7, topic: "Should cities ban cars?", rulesetJson: JSON.stringify({ mode: "quick_match", topicSource: "random", category: null, timerSeconds: 60, roundCount: 1, inputMode: "either", aiAnalysis: false }), state: "speaking", stateVersion: 2, currentRound: 1, activeSide: "pro", deadlineAt: null };
  const players = [
    { roomId: room.id, userId: 7, side: "pro", ready: 1, connected: 1 },
    { roomId: room.id, userId: 8, side: "con", ready: 1, connected: 1 },
  ];
  const db: any = {
    select: () => ({ from: (table: any) => ({ where: (_condition: unknown) => ({ limit: async () => {
      if (table === roomPlayers) return players.filter(player => player.userId === 7);
      if (table === multiplayerRooms) return [room];
      if (table === roomTurns) return turns;
      return [];
    }, then: undefined, }), }), }),
    update: (table: any) => ({ set: (value: unknown) => ({ where: async () => { updates.push({ table, value }); } }) }),
    insert: (table: any) => ({ values: async (value: any) => { if (table === roomTurns) turns.push(value); } }),
  };
  db.select = () => ({ from: (table: any) => ({ where: (_condition: unknown) => {
    const rows = table === roomPlayers ? players : table === multiplayerRooms ? [room] : table === roomTurns ? turns : table === roomEvents ? [] : [];
    return {
      limit: async () => table === roomPlayers ? players.filter(player => player.userId === 7) : table === roomTurns ? turns : rows,
      orderBy: async () => rows,
      then: (resolve: (value: any[]) => unknown) => Promise.resolve(rows).then(resolve),
    };
  } }) });
  return { db, turns, updates };
}

describe("multiplayer router idempotency", () => {
  beforeEach(() => { ENV.multiplayerEnabled = true; });

  it("treats the same submitTurn request as a duplicate on the router path", async () => {
    const fake = createFakeDb();
    getDbMock.mockResolvedValue(fake.db);
    const caller = appRouter.createCaller(context);
    const input = { roomId: "room_router_test", round: 1, side: "pro" as const, transcript: "A concise argument.", idempotencyKey: "00000000-0000-4000-8000-000000000001" };
    const first = await caller.multiplayer.submitTurn(input);
    const second = await caller.multiplayer.submitTurn(input);
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(fake.turns).toHaveLength(1);
    expect(fake.updates).toHaveLength(1);
  });
});
