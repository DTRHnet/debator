import { describe, expect, it } from "vitest";
import { canHostCancel, chooseSides, nextRoomState, reconcileRoomState, rulesetHash, submitTurnOnce } from "./multiplayerService";

const ruleset = {
  mode: "quick_match" as const,
  topicSource: "random" as const,
  category: null,
  timerSeconds: 60 as const,
  roundCount: 1 as const,
  inputMode: "either" as const,
  aiAnalysis: true,
};

describe("multiplayer service", () => {
  it("hashes the same ruleset deterministically", () => {
    expect(rulesetHash(ruleset)).toBe(rulesetHash({ ...ruleset }));
  });

  it("assigns opposite sides deterministically without trusting the client", () => {
    expect(chooseSides(7, 11)).toEqual([{ userId: 7, side: "pro" }, { userId: 11, side: "con" }]);
    expect(chooseSides(11, 7)).toEqual([{ userId: 11, side: "con" }, { userId: 7, side: "pro" }]);
  });

  it("requires two ready players before countdown and advances turns canonically", () => {
    expect(nextRoomState({ state: "waiting", players: 1, readyPlayers: 1, activeSide: null, command: "ready" }).state).toBe("waiting");
    expect(nextRoomState({ state: "waiting", players: 2, readyPlayers: 2, activeSide: null, command: "ready" }).state).toBe("countdown");
    expect(nextRoomState({ state: "countdown", players: 2, readyPlayers: 2, activeSide: null, command: "request_snapshot" }).state).toBe("speaking");
    expect(nextRoomState({ state: "speaking", players: 2, readyPlayers: 2, activeSide: "pro", command: "submit_turn" })).toEqual({ state: "turn_submitted", activeSide: "pro" });
    expect(nextRoomState({ state: "turn_submitted", players: 2, readyPlayers: 2, activeSide: "pro", command: "request_snapshot" })).toEqual({ state: "speaking", activeSide: "con" });
    expect(nextRoomState({ state: "turn_submitted", players: 2, readyPlayers: 2, activeSide: "con", command: "request_snapshot" })).toEqual({ state: "round_complete", activeSide: null });
  });

  it("reconciles a newer durable event after a restart", () => {
    expect(reconcileRoomState({ persistedState: "speaking", persistedVersion: 2, latestEvent: { type: "cancelled", eventId: 3 } })).toEqual({ state: "cancelled", stateVersion: 3, recovered: true });
    expect(reconcileRoomState({ persistedState: "speaking", persistedVersion: 3, latestEvent: { type: "cancelled", eventId: 2 } }).recovered).toBe(false);
  });

  it("enforces host cancellation boundaries", () => {
    expect(canHostCancel({ hostUserId: 7, state: "waiting" }, 7)).toBe(true);
    expect(canHostCancel({ hostUserId: 7, state: "speaking" }, 7)).toBe(false);
    expect(canHostCancel({ hostUserId: 7, state: "waiting" }, 8)).toBe(false);
  });

  it("deduplicates turn writes by idempotency key", async () => {
    const rows: any[] = [];
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => rows.filter(row => row.idempotencyKey === "key-1") }) }) }),
      insert: () => ({ values: async (value: any) => { rows.push(value); } }),
    };
    const input = { roomId: "room_12345678", userId: 7, round: 1, side: "pro" as const, transcript: "argument", idempotencyKey: "key-1" };
    expect((await submitTurnOnce(db, input)).duplicate).toBe(false);
    expect((await submitTurnOnce(db, input)).duplicate).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("distinguishes pre-game cancellation from in-game abandonment", () => {
    expect(nextRoomState({ state: "waiting", players: 2, readyPlayers: 1, activeSide: null, command: "leave_room" }).state).toBe("cancelled");
    expect(nextRoomState({ state: "speaking", players: 2, readyPlayers: 2, activeSide: "pro", command: "leave_room" }).state).toBe("abandoned");
  });
});
