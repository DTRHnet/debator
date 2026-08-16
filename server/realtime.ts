import type { IncomingMessage, Server } from "http";
import { createHash } from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";
import { getRoomEventsSince, getRoomForUser, toRoomSnapshot } from "./multiplayerService";
import { multiplayerRealtimeClientFrameSchema } from "../shared/multiplayer";

 type LiveConnection = { ws: WebSocket; roomId: string; userId: number; handle: string; alive: boolean; connectionToken: string };
const connections = new Map<string, Set<LiveConnection>>();

export function hasOtherLiveConnection(connectionsInRoom: Array<{ userId: number; ws: { readyState: number } }>, userId: number, openState: number) {
  return connectionsInRoom.some(candidate => candidate.userId === userId && candidate.ws.readyState === openState);
}

export function isRealtimeTransportEnabled() {
  return ENV.multiplayerEnabled && ENV.multiplayerRealtimeEnabled;
}

export function getRealtimeConnectionsForTesting(roomId: string) {
  return Array.from(connections.get(roomId) ?? []);
}

export function sweepHeartbeats(roomConnections: Array<{ alive: boolean; ws: { terminate: () => void; ping: () => void } }>) {
  for (const connection of roomConnections) {
    if (!connection.alive) {
      connection.ws.terminate();
    } else {
      connection.alive = false;
      connection.ws.ping();
    }
  }
}

function tokenForConnection(req: IncomingMessage) {
  return createHash("sha256").update(`${req.headers.cookie ?? ""}:${req.headers["user-agent"] ?? ""}`).digest("hex").slice(0, 12);
}

function broadcast(roomId: string, message: unknown, except?: LiveConnection) {
  const payload = JSON.stringify(message);
  for (const connection of Array.from(connections.get(roomId) ?? [])) {
    if (connection !== except && connection.ws.readyState === WebSocket.OPEN) connection.ws.send(payload);
  }
}

function normalizeRoomEvent(event: any) {
  const payload = typeof event.payloadJson === "string" ? JSON.parse(event.payloadJson) : (event.payload ?? {});
  return { eventId: event.eventId, type: event.type, payload: { type: event.type, ...payload }, createdAt: event.createdAt };
}

export function broadcastRoomEvent(roomId: string, event: unknown) {
  broadcast(roomId, { type: "room_event", event: normalizeRoomEvent(event) });
}

async function updatePresence(roomId: string, userId: number, connected: 0 | 1) {
  const db = await getDb();
  if (!db) return;
  const { roomPlayers } = await import("../drizzle/schema");
  const { and, eq } = await import("drizzle-orm");
  await db.update(roomPlayers).set({ connected }).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, userId)));
}

async function joinConnection(connection: LiveConnection, frame: { type: "join"; roomId: string; lastEventId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable.");
  const result = await getRoomForUser(db, frame.roomId, connection.userId);
  if (!result) throw new Error("Room not found or access denied.");
  connection.roomId = frame.roomId;
  await updatePresence(frame.roomId, connection.userId, 1);
  const set = connections.get(frame.roomId) ?? new Set<LiveConnection>();
  set.add(connection);
  connections.set(frame.roomId, set);
  const events = (await getRoomEventsSince(db, frame.roomId, frame.lastEventId ?? 0)).map(normalizeRoomEvent);
  connection.ws.send(JSON.stringify({ type: "room_snapshot", snapshot: toRoomSnapshot(result.room, result.players), events, connectionToken: connection.connectionToken }));
  broadcast(frame.roomId, { type: "presence", userId: connection.userId, handle: connection.handle, connected: true }, connection);
}

export function registerRealtimeTransport(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", async (req, socket, head) => {
    if (req.url?.split("?")[0] !== "/api/multiplayer/ws") return;
    if (!isRealtimeTransportEnabled()) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    try {
      const user = await sdk.authenticateRequest(req as any);
      if (!user) throw new Error("Unauthorized");
      wss.handleUpgrade(req, socket, head, ws => {
        const connection: LiveConnection = { ws, roomId: "", userId: user.id, handle: user.name ?? "Player", alive: true, connectionToken: tokenForConnection(req) };
        ws.on("pong", () => { connection.alive = true; });
        ws.on("message", async raw => {
          try {
            const frame = multiplayerRealtimeClientFrameSchema.parse(JSON.parse(raw.toString()));
            if (frame.type === "join") await joinConnection(connection, frame);
            if (frame.type === "ping") ws.send(JSON.stringify({ type: "pong", at: Date.now() }));
          } catch (error) {
            ws.send(JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "Realtime request failed." }));
          }
        });
        ws.on("close", () => {
          if (!connection.roomId) return;
          const set = connections.get(connection.roomId);
          set?.delete(connection);
          if (set && set.size === 0) connections.delete(connection.roomId);
          const stillConnected = hasOtherLiveConnection(Array.from(set ?? []), connection.userId, WebSocket.OPEN);
          if (!stillConnected) {
            void updatePresence(connection.roomId, connection.userId, 0);
            broadcast(connection.roomId, { type: "presence", userId: connection.userId, handle: connection.handle, connected: false });
          }
        });
      });
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });
  const heartbeat = setInterval(() => {
    for (const set of Array.from(connections.values())) sweepHeartbeats(Array.from(set));
  }, 25_000);
  heartbeat.unref();
  return wss;
}
