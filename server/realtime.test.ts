import { createServer } from "http";
import WebSocket from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { multiplayerRealtimeClientFrameSchema, multiplayerRealtimeServerFrameSchema } from "../shared/multiplayer";

const authenticateRequest = vi.fn();
const getDb = vi.fn();
const getRoomForUser = vi.fn();
const getRoomEventsSince = vi.fn();
const toRoomSnapshot = vi.fn();

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("./db", () => ({ getDb }));
vi.mock("./multiplayerService", () => ({ getRoomForUser, getRoomEventsSince, toRoomSnapshot }));

const { getRealtimeConnectionsForTesting, hasOtherLiveConnection, isRealtimeTransportEnabled, registerRealtimeTransport, sweepHeartbeats } = await import("./realtime");
const { ENV } = await import("./_core/env");

let activeServer: ReturnType<typeof createServer> | undefined;
const presenceUpdates: number[] = [];

afterEach(async () => {
  ENV.multiplayerEnabled = false;
  ENV.multiplayerRealtimeEnabled = false;
  authenticateRequest.mockReset();
  getDb.mockReset();
  presenceUpdates.length = 0;
  getRoomForUser.mockReset();
  getRoomEventsSince.mockReset();
  toRoomSnapshot.mockReset();
  if (!activeServer) return;
  await new Promise<void>(resolve => activeServer?.close(() => resolve()));
  activeServer = undefined;
});

function makeSnapshot() {
  return {
    roomId: "room_12345678", state: "waiting", stateVersion: 2, serverNow: Date.now(), topic: "Should cities ban cars?",
    ruleset: { mode: "quick_match", topicSource: "random", category: null, timerSeconds: 30, roundCount: 1, inputMode: "typed", aiAnalysis: false },
    round: 1, activeSide: null, players: [{ userId: 7, handle: "Debater_7", side: "pro", connected: true, ready: false }], deadlineAt: null,
  };
}

async function startTransport() {
  ENV.multiplayerEnabled = true;
  ENV.multiplayerRealtimeEnabled = true;
  authenticateRequest.mockResolvedValue({ id: 7, name: "Debater_7" });
  getDb.mockResolvedValue({ update: () => ({ set: (values: { connected: number }) => ({ where: async () => { presenceUpdates.push(values.connected); } }) }) });
  getRoomForUser.mockResolvedValue({ room: { id: "room_12345678", rulesetJson: "{}" }, players: [] });
  getRoomEventsSince.mockResolvedValue([]);
  toRoomSnapshot.mockReturnValue(makeSnapshot());
  activeServer = createServer();
  registerRealtimeTransport(activeServer);
  await new Promise<void>(resolve => activeServer?.listen(0, "127.0.0.1", () => resolve()));
  const address = activeServer.address();
  return typeof address === "object" && address ? address.port : 0;
}

function receiveSnapshot(socket: WebSocket) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("snapshot timeout")), 3000);
    socket.on("message", data => {
      const frame = JSON.parse(data.toString());
      if (frame.type === "room_snapshot") { clearTimeout(timer); resolve(frame); }
    });
    socket.on("error", reject);
  });
}

describe("realtime multiplayer contracts", () => {
  it("accepts a reconnect-aware room join frame", () => {
    expect(multiplayerRealtimeClientFrameSchema.parse({ type: "join", roomId: "room_12345678", lastEventId: 12 })).toMatchObject({ type: "join", lastEventId: 12 });
  });

  it("rejects malformed client frames", () => {
    expect(() => multiplayerRealtimeClientFrameSchema.parse({ type: "join", roomId: "tiny" })).toThrow();
  });

  it("validates a strict versioned event envelope", () => {
    expect(multiplayerRealtimeServerFrameSchema.parse({ type: "room_event", event: { eventId: 13, type: "countdown", payload: { type: "countdown", stateVersion: 4 } } })).toMatchObject({ type: "room_event" });
  });

  it("terminates stale sockets and probes live sockets during heartbeat sweep", () => {
    const stale = { alive: false, ws: { terminate: vi.fn(), ping: vi.fn() } };
    const live = { alive: true, ws: { terminate: vi.fn(), ping: vi.fn() } };
    sweepHeartbeats([stale, live]);
    expect(stale.ws.terminate).toHaveBeenCalledOnce();
    expect(live.ws.ping).toHaveBeenCalledOnce();
    expect(live.alive).toBe(false);
  });

  it("does not mark a player offline while another socket remains open", () => {
    expect(hasOtherLiveConnection([{ userId: 7, ws: { readyState: 1 } }, { userId: 7, ws: { readyState: 3 } }], 7, 1)).toBe(true);
    expect(hasOtherLiveConnection([{ userId: 7, ws: { readyState: 3 } }], 7, 1)).toBe(false);
  });

  it("rejects an upgrade while the staging gate is off", async () => {
    activeServer = createServer();
    registerRealtimeTransport(activeServer);
    await new Promise<void>(resolve => activeServer?.listen(0, "127.0.0.1", () => resolve()));
    const address = activeServer.address();
    const port = typeof address === "object" && address ? address.port : 0;
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/api/multiplayer/ws`);
      socket.on("unexpected-response", (_request, response) => { expect(response.statusCode).toBe(403); resolve(); });
      socket.on("error", error => { if (!String(error.message).includes("Unexpected server response")) reject(error); });
    });
    expect(isRealtimeTransportEnabled()).toBe(false);
  });

  it("authenticates a join and returns an authoritative snapshot", async () => {
    const port = await startTransport();
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/multiplayer/ws`, { headers: { Cookie: "app_session=valid" } });
    const framePromise = receiveSnapshot(socket);
    await new Promise<void>(resolve => socket.once("open", () => { socket.send(JSON.stringify({ type: "join", roomId: "room_12345678" })); resolve(); }));
    const frame = await framePromise;
    expect(frame.snapshot.roomId).toBe("room_12345678");
    expect(authenticateRequest).toHaveBeenCalled();
    socket.close();
  });

  it("cleans persisted presence and broadcasts disconnect after a heartbeat-style termination", async () => {
    const port = await startTransport();
    authenticateRequest.mockReset();
    authenticateRequest.mockResolvedValueOnce({ id: 7, name: "Debater_7" }).mockResolvedValueOnce({ id: 8, name: "Debater_8" });
    const first = new WebSocket(`ws://127.0.0.1:${port}/api/multiplayer/ws`, { headers: { Cookie: "app_session=a" } });
    const second = new WebSocket(`ws://127.0.0.1:${port}/api/multiplayer/ws`, { headers: { Cookie: "app_session=b" } });
    const firstSnapshot = receiveSnapshot(first);
    const secondSnapshot = receiveSnapshot(second);
    await new Promise<void>(resolve => first.once("open", () => { first.send(JSON.stringify({ type: "join", roomId: "room_12345678" })); resolve(); }));
    await new Promise<void>(resolve => second.once("open", () => { second.send(JSON.stringify({ type: "join", roomId: "room_12345678" })); resolve(); }));
    await Promise.all([firstSnapshot, secondSnapshot]);
    const presence = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("presence timeout")), 3000);
      second.on("message", data => {
        const frame = JSON.parse(data.toString());
        if (frame.type === "presence" && frame.userId === 7 && frame.connected === false) { clearTimeout(timer); resolve(frame); }
      });
    });
    const staleConnection = getRealtimeConnectionsForTesting("room_12345678").find(connection => connection.userId === 7);
    expect(staleConnection).toBeDefined();
    if (staleConnection) staleConnection.alive = false;
    sweepHeartbeats(getRealtimeConnectionsForTesting("room_12345678"));
    await presence;
    expect(presenceUpdates).toContain(0);
    second.close();
  });

  it("reconnects with lastEventId and receives missed events", async () => {
    const port = await startTransport();
    getRoomEventsSince.mockImplementation(async (_db: unknown, _roomId: string, lastEventId: number) => lastEventId === 4 ? [{ eventId: 5, type: "countdown", payloadJson: JSON.stringify({ stateVersion: 5 }) }] : [{ eventId: 4, type: "countdown", payloadJson: JSON.stringify({ stateVersion: 4 }) }]);
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/multiplayer/ws`, { headers: { Cookie: "app_session=valid" } });
    const firstPromise = receiveSnapshot(socket);
    await new Promise<void>(resolve => socket.once("open", () => { socket.send(JSON.stringify({ type: "join", roomId: "room_12345678" })); resolve(); }));
    await firstPromise;
    socket.close();
    const reconnect = new WebSocket(`ws://127.0.0.1:${port}/api/multiplayer/ws`, { headers: { Cookie: "app_session=valid" } });
    const replayPromise = receiveSnapshot(reconnect);
    await new Promise<void>(resolve => reconnect.once("open", () => { reconnect.send(JSON.stringify({ type: "join", roomId: "room_12345678", lastEventId: 4 })); resolve(); }));
    const replay = await replayPromise;
    expect(replay.events).toEqual([expect.objectContaining({ eventId: 5, payload: expect.objectContaining({ type: "countdown" }) })]);
    reconnect.close();
  });
});
