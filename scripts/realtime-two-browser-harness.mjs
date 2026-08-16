import assert from "node:assert/strict";
import WebSocket from "ws";

const baseUrl = process.env.REALTIME_BASE_URL ?? "http://127.0.0.1:3000";
const roomId = process.env.ROOM_ID;
const cookieA = process.env.BROWSER_A_COOKIE;
const cookieB = process.env.BROWSER_B_COOKIE;

if (!roomId || !cookieA || !cookieB) {
  throw new Error("Set ROOM_ID, BROWSER_A_COOKIE, and BROWSER_B_COOKIE before running the realtime harness.");
}

const wsUrl = `${baseUrl.replace(/^http/, "ws")}/api/multiplayer/ws`;

function openClient(cookie, lastEventId = 0) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl, { headers: { Cookie: cookie } });
    const frames = [];
    const timer = setTimeout(() => reject(new Error("Timed out waiting for room snapshot.")), 10_000);
    socket.on("open", () => socket.send(JSON.stringify({ type: "join", roomId, lastEventId })));
    socket.on("message", data => {
      const frame = JSON.parse(data.toString());
      frames.push(frame);
      if (frame.type === "room_snapshot") {
        clearTimeout(timer);
        resolve({ socket, frames, snapshot: frame.snapshot, events: frame.events });
      }
    });
    socket.on("error", reject);
  });
}

const first = await openClient(cookieA);
const second = await openClient(cookieB);
assert.equal(first.snapshot.roomId, roomId);
assert.equal(second.snapshot.roomId, roomId);
assert.ok(first.snapshot.players.length >= 1);

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Timed out waiting for presence broadcast.")), 5_000);
  const onFrame = data => {
    const frame = JSON.parse(data.toString());
    if (frame.type === "presence" && frame.connected === true) {
      clearTimeout(timer);
      first.socket.off("message", onFrame);
      resolve();
    }
  };
  first.socket.on("message", onFrame);
});

const lastEventId = Math.max(0, ...first.events.map(event => event.eventId ?? 0));
first.socket.close();
const reconnected = await openClient(cookieA, lastEventId);
assert.equal(reconnected.snapshot.roomId, roomId);
console.log(JSON.stringify({ ok: true, roomId, firstEventId: lastEventId, replayedEvents: reconnected.events.length }));
second.socket.close();
reconnected.socket.close();
