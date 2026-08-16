# DebateRush Multiplayer Roadmap

**Target branch:** `multiplayer`  
**Status:** Approved for implementation planning  
**Author:** Manus AI  
**Planning date:** 2026-08-16

## 1. Objective and product boundary

DebateRush should evolve from a solo debate-practice app into an authenticated player-versus-player experience without disrupting the existing solo, offline, speech-capture, or AI-judged modes. Multiplayer players should be able to enter randomized matching, host private rooms, debate under synchronized server timers, receive a human-match result plus optional AI analysis, retain durable statistics, and appear on privacy-aware competitive leaderboards.

The first release should be deliberately narrow: two players, one room at a time per account, no spectators, no tournaments, curated/random public topics, private custom motions, one to three rounds per side, and 30/45/60/90-second turns. More complex formats can be added after the authoritative room and rating foundations are reliable.

## 2. Recommended architecture

Keep the existing React 19 + Express + tRPC + Drizzle/MySQL + Manus OAuth foundation. tRPC should remain the contract for authenticated CRUD and commands such as queue entry, room creation, profile, history, statistics, and leaderboard queries. Add a small server-authoritative WebSocket layer for presence, countdowns, turn transitions, reconnect snapshots, and result events. Shared Zod schemas should validate both tRPC mutations and WebSocket commands so the HTTP and realtime paths cannot drift.

The room server must be authoritative. Clients send intents; the server validates them, advances the room state, persists the result, and broadcasts the resulting event. The client never decides that a deadline passed, assigns sides, accepts a turn, changes a rating, or finishes a game solely because a local timer or optimistic state changed.

### Hosting decision

The first multiplayer deployment should use **WebDev Reserved Hosting**. The existing Autoscale deployment is stateless and may cold-start or place requests on different instances, which is unsafe if active room state lives only in memory. Reserved Hosting provides a managed single persistent process suitable for lightweight WebSocket rooms and short-lived in-memory indexes. It is usage-based, with a full-utilization ceiling of approximately **$37.50 per month** for 1 vCPU and 0.5 GB RAM before the included monthly usage credit, plus metered egress. This is a ceiling, not a flat fee.

Durable room state and event records must still live in MySQL. The process should recover from its database event ledger after restart, or close a room with a clearly non-punitive outcome if recovery is impossible. If concurrency outgrows one reserved instance, move room presence and event fan-out to shared infrastructure and scale WebSocket gateways horizontally rather than depending on local memory.

## 3. Player-facing controls

The setup screen should expose a validated ruleset that is frozen when a room begins.

| Control | Initial choices | Server behavior |
|---|---|---|
| Match mode | Quick Match, Private Room, Invite Link | Quick Match enters the queue; private rooms use a short-lived join token |
| Topic source | Random, category, curated pack, custom motion | Public custom motions are deferred; private rooms may use length-limited custom text |
| Category | All current DebateRush categories | Both players receive one canonical topic/category record |
| Side assignment | Random by default; host-selected in private rooms | Quick Match sides are assigned server-side after both players lock in |
| Turn duration | 30, 45, 60, 90 seconds | The server owns the deadline and sends synchronized timestamps |
| Rounds | 1, 2, or 3 per side | Reject a ruleset that exceeds the room’s maximum total duration |
| Input | Microphone, typed, or either | Typed fallback remains available when mic permission fails |
| AI analysis | On/off after the human game | AI must not block or decide human turn submission |
| Rematch | Same rules, swap sides, new random motion, return to queue | Both players must accept within a short window |
| Pause | Disabled in Quick Match; one acknowledged private-room pause | Server-enforced maximum pause duration |

The host may start only when both authenticated players are present, have accepted the rules, and have acknowledged readiness. Leaving before the game starts is not a loss. Leaving after the first locked turn becomes an abandonment and is recorded distinctly from a normal defeat. Server failures should never create a player penalty.

## 4. Authentication, profile, and privacy

Manus OAuth remains the only authentication mechanism. Every queue, room, turn, result, statistic, and leaderboard operation must resolve the user from the authenticated server context rather than a client-supplied ID. Add a `player_profiles` record with a unique public handle, optional avatar reference, privacy controls, preferred categories, and matchmaking preferences. Keep OAuth identifiers, email addresses, and private profile data out of public room and leaderboard payloads.

Prevent duplicate active sessions from corrupting a room. Each player-room membership should have a lease and connection token. A second tab can become read-only or replace the older connection after an explicit server decision. Every state-changing command needs an idempotency key so reconnects and browser retries cannot submit a turn twice.

## 5. Matchmaking and randomized pairing

Persist matchmaking intent in a database queue, with an in-memory index for quick lookup. A queue entry contains user ID, ruleset hash, rating band, category preference, language, latency/region class when available, creation time, status, and expiry. It must not contain private transcript content.

The matching algorithm should use the following sequence:

1. Reject a player already in an active room, with an active queue entry, or under a matchmaking cooldown.
2. Partition candidates by compatible ruleset, language, and latency class. Never silently pair incompatible timers or round counts.
3. Begin with a narrow rating window, such as plus or minus 100 points, and expand it gradually every 10–15 seconds to a capped range.
4. Prefer the oldest compatible entry, then the smallest rating distance. Do not repeatedly pair the same opponents within a rolling cooldown unless the pool is empty.
5. Atomically claim both entries with a transaction or compare-and-swap guard. If one claim loses, requeue the unclaimed candidate rather than creating a half-room.
6. Create the room, select sides using a server-side secure random decision, notify both players, and require ready acknowledgements.
7. Expire unconfirmed matches quickly. Return players to the queue with a reason and do not punish an opponent or server timeout.

Start competitive rating at 1000 and use a simple Elo model for the first release, including draws and a reduced K-factor for provisional players. Store pre-match rating, post-match rating, outcome, and opponent rating as immutable rating events. A confidence-aware rating model can replace Elo after real match volume exists.

## 6. Server-authoritative room state

Use explicit states and reject invalid transitions.

| State | Allowed transitions | Required controls |
|---|---|---|
| `waiting` | `ready`, `cancelled`, `expired` | Validate room membership and invite/queue origin |
| `ready` | `countdown`, `cancelled` | Freeze topic, sides, ruleset, and player list |
| `countdown` | `speaking`, `cancelled` | Broadcast a monotonic server start timestamp |
| `speaking` | `turn_submitted`, `turn_timeout`, `abandoned` | Accept exactly one idempotent submission |
| `turn_submitted` | `speaking`, `round_complete` | Persist transcript metadata and advance the canonical turn |
| `round_complete` | `speaking`, `judging`, `abandoned` | Start the next round or final analysis |
| `judging` | `completed`, `judging_unavailable` | Persist result, ratings, stats, and safe notifications |
| `completed` | `rematch`, `closed` | Keep the completed room immutable |

Every event should include `roomId`, `stateVersion`, `serverNow`, and a monotonic `eventId`. The initial event vocabulary should include `room_snapshot`, `presence`, `countdown`, `turn_started`, `turn_ended`, `opponent_submitted`, `judging_started`, `result_ready`, and a safe structured `error`. A reconnect request carries the last event ID; the server replays missed events or sends a full snapshot when the gap is too large.

Heartbeat and connection timeouts must be explicit. During play, broadcast only the minimum transcript information required by the room policy. Full transcripts and AI reasoning should become visible after the relevant turn or at the final result. Sanitize all user-controlled text before rendering and enforce transcript length limits at the server.

## 7. Database model

Use additive migrations and UTC timestamps. Suggested tables and indexes are:

| Table | Purpose | Key constraints |
|---|---|---|
| `player_profiles` | Public multiplayer identity | Unique user ID and handle |
| `matchmaking_queue` | Durable pairing intent | Active-user uniqueness, status and expiry indexes |
| `multiplayer_rooms` | Room metadata and lifecycle | Ruleset hash, status, state version, timestamps |
| `room_players` | Membership and side assignment | Unique room/user pair and one side per player |
| `room_turns` | Immutable turn ledger | Room/round/side uniqueness, idempotency key |
| `multiplayer_results` | Final outcome and rubric | One result per room, rating deltas, AI reference |
| `player_rating_events` | Auditable ratings | Prior/new rating, outcome, opponent, room |
| `player_stats_daily` | Efficient trend reads | User/date uniqueness and category aggregates |
| `leaderboard_snapshots` | Stable ranked pages | Scope/season/rank indexes |
| `room_events` | Recovery and audit trail | Room/event ID uniqueness and retention policy |

Never store audio bytes in MySQL. If audio replay is later approved, store bytes in object storage and retain only an authorized metadata reference. Raw room events and transcripts need explicit retention and privacy rules.

## 8. APIs and realtime contracts

Add protected tRPC procedures for `profile.get/update`, `matchmaking.enqueue/cancel/status`, `rooms.create/join/leave/ready`, `rooms.rematch`, `rooms.history`, `stats.me`, and `leaderboards.list`. Add server helpers for queue claims, room transitions, rating changes, event append/replay, and result accounting.

Shared schemas must cover rulesets, room snapshots, commands, turn submissions, result cards, leaderboard pages, and error codes. Validate authorization, room membership, side ownership, state version, deadline, transcript length, and idempotency on every mutation. A client must not be able to submit for the opponent, change rules after start, or retry a rating update as a new game.

## 9. Client experience and reconnect behavior

Add Match, Room, Live Game, Result, Profile, Stats, and Leaderboards views inside the existing shell. The live game needs visible opponent presence, server-synchronized countdown, round/side indicator, connection quality, microphone/typed controls, submission acknowledgement, and reconnect state.

When disconnected, preserve the last authoritative snapshot and allow local draft editing without claiming submission. On reconnect, reconcile by state version and idempotency key. If the deadline passed while offline, the server wins and the UI explains the result. A room should remain understandable even when a mic permission request fails or an AI analysis is unavailable.

## 10. Statistics and leaderboards

Track games played, wins, losses, draws, abandons, completion rate, rating, peak rating, average rubric scores, score by side and category, average response time, and streaks. Keep human competitive rating separate from solo AI-practice scores.

Launch with opt-in all-time, monthly season, friends/visible-profile, and category leaderboards. Require a minimum number of completed games, rank by rating with a stable tie-breaker, and expose only consented public handles. Exclude server-fault forfeits, cap gains against provisional opponents, flag suspicious repeated matches, and make rating updates idempotent from the rating-event ledger.

## 11. Security, abuse, and observability

Rate-limit queue operations, room creation, WebSocket handshakes, transcript submissions, rematches, and AI judging. Use short-lived invite tokens, origin checks, CSRF protection for HTTP mutations, authenticated WebSocket handshakes, safe room codes, transcript limits, and moderation hooks for public handles and custom motions. Provide an admin appeal path for incorrect forfeits without mutating immutable turn records.

Instrument queue wait time, match success, match cancellation, reconnects, turn timeouts, room errors, judging latency, fallback-model use, leaderboard lag, and process-restart recovery. Never log API keys, OAuth tokens, raw private transcripts, or private profile fields.

## 12. Delivery roadmap

### Phase 0 — Branch and architecture record

Create `multiplayer` from the stable main baseline. Commit this roadmap as a documentation-only change. Record open decisions, hosting selection, feature-flag policy, and rollback procedure.

### Phase 1 — Identity, rulesets, and persistence

Add profiles, ruleset validation, room/queue/turn/result/rating/stats/leaderboard/event tables, additive migrations, indexes, and protected tRPC contracts. Add authorization, uniqueness, and idempotency tests.

### Phase 2 — Room authority and transport

Implement the WebSocket handshake, room state machine, heartbeat, server timers, state versions, event replay, reconnect snapshots, and restart recovery. Add a deterministic fake clock and two-player integration tests.

### Phase 3 — Matchmaking and game UI

Implement Quick Match, private rooms, invite links, ready checks, side assignment, turn submission, reconnect UI, human results, and the feature flag. Test two independent authenticated browser sessions on desktop and mobile.

### Phase 4 — Ratings, stats, and leaderboards

Add Elo rating events, daily aggregation, seasonal snapshots, privacy controls, minimum-game thresholds, reconciliation, and abuse checks. Prove retries cannot double-count games or ratings.

### Phase 5 — Hardening and staged beta

Load-test concurrent rooms within Reserved Hosting limits. Test process restart, reconnect, stale commands, background tabs, mobile Safari/Chrome, mic fallback, privacy boundaries, and rate limits. Enable public matchmaking only after staging metrics are healthy.

## 13. Acceptance criteria

The first multiplayer release is complete when two authenticated sessions can enter one Quick Match room, receive the same canonical topic and opposite sides, complete every configured turn, survive a reconnect, and receive exactly one persisted result. Repeated or stale commands must not advance the room twice. A process restart must recover from durable events or end the room with a clear non-punitive outcome. Solo play must continue to work with the multiplayer flag disabled.

Required automated coverage includes ruleset validation, matching windows, queue expiry, authorization, room transitions, server deadlines, event replay, reconnects, stale commands, duplicate submissions, abandonment, rating updates, redaction, rate limits, result persistence, and leaderboard aggregation. Browser coverage should exercise two authenticated players and mobile layouts. Load tests should measure queue contention and concurrent rooms.

## 14. Decisions required before implementation

1. Should public Quick Match allow custom motions, or should custom motions remain private-room-only until moderation is mature?
2. Should AI analysis be default, opt-in, or limited to a daily allowance?
3. Are leaderboards opt-in by default, and which profile fields are public?
4. Is Reserved Hosting acceptable for the beta budget and expected concurrency?
5. Are spectators, friends-only matching, tournaments, or team formats explicitly post-beta?
6. Should launch ratings use simple Elo or a confidence-aware model?

## 15. Definition of done

The branch is implementation-ready when this roadmap is committed, ruleset and state contracts have owners, migrations are reviewed, hosting mode is selected with its cost acknowledged, the test matrix covers happy paths and failures, and multiplayer is feature-flagged and rollback-ready. Future changes to matching, rating, privacy, retention, or room authority should update this document or add an ADR on the `multiplayer` branch.

## References

[1]: https://github.com/DTRHnet/debator "DTRHnet/debator repository"
[2]: https://manus.im "Manus platform"
[3]: https://openrouter.ai/docs "OpenRouter documentation"
[4]: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket "MDN WebSocket API"

The roadmap intentionally separates planning from implementation: the first branch commit contains documentation only; subsequent multiplayer code should arrive in reviewed, independently testable phases.

**Approved in Plan Mode:** Yes  
**Target branch:** `multiplayer`  
**Target file:** `docs/multiplayer-roadmap.md`

## Branch execution checklist

- [x] Branch `multiplayer` created from the stable baseline.
- [x] Roadmap saved as `docs/multiplayer-roadmap.md`.
- [ ] Documentation commit created.
- [ ] Branch pushed to `DTRHnet/debator`.
- [ ] Remote branch and commit verified.

## Implementation guardrails

- Keep solo gameplay unchanged while introducing multiplayer contracts.
- Do not trust client clocks or side assignments.
- Do not store audio bytes in database columns.
- Do not expose private OAuth identifiers or raw transcripts in public rankings.
- Make room mutations idempotent and ratings exactly-once.
- Keep public matchmaking behind a feature flag until staging evidence passes.

**Document owner:** DebateRush engineering  
**Review cadence:** Before each multiplayer implementation phase and before beta launch.

## References

[1]: https://github.com/DTRHnet/debator "DTRHnet/debator repository"
[2]: https://manus.im "Manus platform"
[3]: https://openrouter.ai/docs "OpenRouter documentation"
[4]: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket "MDN WebSocket API"

## Approval record

The user approved this roadmap as-is in Plan Mode. Execution begins with this documentation-only branch commit.

## Final delivery fields

- Branch: `multiplayer`
- File: `docs/multiplayer-roadmap.md`
- Commit: pending
- Remote push: pending

## End of roadmap
