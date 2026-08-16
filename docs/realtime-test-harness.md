# DebateRush realtime staging harness

The multiplayer room transport is intentionally gated by two server-side environment flags so solo practice remains unaffected. Enable `MULTIPLAYER_ENABLED=true` and `MULTIPLAYER_REALTIME_ENABLED=true` only in a staging or reserved-hosting test environment. The transport authenticates the WebSocket upgrade with the same Manus OAuth session cookie used by the protected tRPC procedures.

After two authenticated browser sessions have been matched into a room, copy each browser’s session cookie and run the harness with the room identifier:

```bash
REALTIME_BASE_URL=https://staging.example.com \
ROOM_ID=room_... \
BROWSER_A_COOKIE='app_session=...' \
BROWSER_B_COOKIE='app_session=...' \
pnpm run test:realtime-harness
```

The harness opens two authenticated clients, joins the same room, verifies that both receive an authoritative snapshot, waits for a presence broadcast, closes and reconnects the first client with its last observed event identifier, and verifies that the reconnect receives a valid snapshot and replay window. It does not manufacture users, rooms, ratings, or game results; the room must come from the normal matchmaking flow.

During normal client operation, the room page prefers live WebSocket updates, displays a reconnecting state when the socket drops, and retains short-interval tRPC polling as a fallback. The server sends WebSocket protocol pings every 25 seconds and marks room membership disconnected when a socket closes. Reconnects are authorized again and can request events after the last received event identifier.
