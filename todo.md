# Project TODO

- [x] Clone and inspect the DTRHnet/debator repository, then reconcile its useful source files with the managed project scaffold.
- [x] Define database tables for authenticated user preferences and persisted debate sessions with structured verdicts.
- [x] Implement authenticated tRPC APIs for settings, debate-session history, and server-side AI judging.
- [x] Build a mobile-first debate game with random or custom topics, Pro and Con speaking turns, configurable timing, and round management.
- [x] Add Web Speech API live transcription with MediaRecorder fallback and clear microphone-permission error states.
- [x] Add OpenRouter proxy support with a structured judging prompt and an optional per-user API-key setting.
- [x] Build account settings and a database-backed score-history view protected by Manus OAuth.
- [x] Configure the app manifest, service worker, installability, and offline core gameplay behavior.
- [x] Add responsive product styling, accessibility affordances, and helpful empty/loading/error states.
- [x] Add automated tests, run type checks, verify desktop and mobile presentation, and document local setup.
- [x] Add a usable MediaRecorder audio fallback that preserves a local recording when live browser transcription is unavailable.
- [x] Add PWA application icons and strengthen app-shell caching for predictable offline startup after the first visit.
- [x] Add explicit settings and history query-failure states, plus pressed and current-page semantics for custom controls and navigation.
- [x] Add selected semantics to home-screen topic, category, timer, and round controls for keyboard and screen-reader users.
- [x] Expand the debate question bank with additional balanced categories and substantially more unique motions.
- [x] Improve random topic selection so sessions avoid recently used questions and offer a true all-category random option.
- [x] Retrieve and present a current list of OpenRouter free models suitable for structured debate judging.
- [x] Add an optional server-level OpenRouter key and use it as the secure default when a user has not saved a personal key.
- [x] Test the expanded topic system and validate the enhanced AI configuration.
- [x] Restrict the settings model list to debate-appropriate text instruction models and rank structured-output choices first.
- [x] Add testable helpers and coverage for recent-topic exclusion, all-category random selection, and app-wide OpenRouter-key fallback.
- [x] Fix the mobile category selector so every category remains discoverable and easy to choose on small screens.
- [x] Guarantee at least ten unique debate motions in every selectable category.
- [x] Add automated coverage for mobile category presentation and per-category question counts.
- [x] Push the validated mobile category update to DTRHnet/debator.
- [x] Fix the second-speaker text-to-speech or playback transition in the debate round flow.
- [x] Diagnose and eliminate malformed AI verdict request payloads that trigger the reported string-pattern validation error.
- [x] Add regression tests for consecutive speakers and valid final judging payloads.
- [x] Publish the repair to the hosted DebateRush app and push it to DTRHnet/debator.
- [x] Verify the repaired build is live on the DebateRush production domain.
- [x] Exercise the hosted Pro-to-Con transition and completed judging request to verify the repair in production.
- [x] Retry alternate curated free models when the selected OpenRouter provider is temporarily rate-limited.
- [x] Add direct regression coverage for the Pro-to-Con playback transition and legacy offline payload normalization before judging.

- [x] Create the `multiplayer` branch and add the detailed multiplayer architecture roadmap under `docs/`.
- [ ] Push the new `multiplayer` branch to `DTRHnet/debator` and document the resulting commit.
- [x] Preserve the current solo DebateRush behavior while planning multiplayer as an additive feature flag.

## Multiplayer plan history

The approved multiplayer roadmap covers Manus OAuth identity, randomized skill-aware matching, private room hosting, authoritative server state, WebSocket events, reconnection, server-side timers, anti-abuse controls, durable room/turn/rating tables, Elo ratings, stats, privacy-aware leaderboards, Reserved Hosting, testing, rollout phases, and open product decisions.

References: [DTRHnet/debator](https://github.com/DTRHnet/debator), [Manus](https://manus.im), [OpenRouter](https://openrouter.ai/docs).

Author: Manus AI. Target branch: `multiplayer`.

- [ ] Finalize the implementation branch and documentation artifact after the approved plan.
- [ ] Push the branch and provide the commit reference.
- [ ] Keep the multiplayer work additive and behind a feature flag until launch readiness is verified.

## Approved Multiplayer Roadmap

### Objective

Extend DebateRush from solo practice into authenticated player-versus-player debate rooms while preserving solo play. Players should be able to enter randomized matching or host private rooms, share a canonical topic, debate under server-authoritative timers, receive a human result and optional AI analysis, retain a durable history, build ratings and statistics, and appear on privacy-aware leaderboards.

### Platform and runtime decision

Keep the existing React, Express, tRPC, Drizzle/MySQL, and Manus OAuth foundation. Use tRPC for authenticated CRUD and commands; use a WebSocket channel for room presence, clocks, turn events, reconnect snapshots, and result notifications. The first production multiplayer deployment should use WebDev Reserved Hosting because an in-memory authoritative room process requires a long-lived single process. Reserved Hosting is usage-based with a full-utilization ceiling of approximately $37.50/month for 1 vCPU and 0.5 GB RAM before the included monthly credit, plus metered egress. Durable database state and event replay remain mandatory so a process restart has a defined recovery path.

### Player controls

The launch ruleset should expose Quick Match, Private Room, or Invite Link; Random, category, curated pack, or private custom topic; 30/45/60/90-second turns; one to three rounds per side; microphone, typed, or either input; randomized sides; optional AI post-match analysis; and rematch options. Freeze the ruleset when a room starts. Public Quick Match should initially use curated/random topics, while custom motions remain private-room-only until moderation is established. Disable pauses in Quick Match; allow one acknowledged, server-limited pause in private rooms.

### Authentication and profiles

Manus OAuth remains the only login. Resolve every queue, room, submission, result, statistic, and leaderboard operation from authenticated server context, never a client-supplied user ID. Add public handles, optional avatar, privacy settings, preferred categories, and matchmaking preferences while keeping OAuth identifiers and email private. Use a room lease, connection token, duplicate-tab policy, and idempotency keys for reconnect-safe commands.

### Matching algorithm

Persist queue intent with user, ruleset hash, rating band, language, category preference, creation time, status, and expiry. Index active entries for low-latency pairing. Reject players already in rooms or with active queue entries; partition by compatible ruleset/language/latency; start at a narrow rating window and expand every 10–15 seconds to a cap; prefer oldest compatible entry then smallest rating distance; prevent self-matches and add an opponent cooldown; atomically claim both entries; create a room and assign sides server-side; require ready acknowledgements; expire unconfirmed matches without punishing users. Start provisional rating at 1000 and use Elo with draw handling, storing pre/post rating and auditable rating events.

### Authoritative room state

Implement explicit states: `waiting`, `ready`, `countdown`, `speaking`, `turn_submitted`, `round_complete`, `judging`, `completed`, `abandoned`, `expired`, and `cancelled`. The server owns deadlines, validates one submission per side/turn, and broadcasts versioned snapshots. Every event includes room ID, state version, server time, and event ID. Send `room_snapshot`, `presence`, `countdown`, `turn_started`, `turn_ended`, `opponent_submitted`, `judging_started`, `result_ready`, and safe `error` events. On reconnect, replay from the last event ID or send a fresh snapshot. A stale client cannot advance a room or submit for the opponent.

### Data model

Add `player_profiles`, `matchmaking_queue`, `multiplayer_rooms`, `room_players`, `room_turns`, `multiplayer_results`, `player_rating_events`, `player_stats_daily`, `leaderboard_snapshots`, and `room_events`. Use UTC timestamps, uniqueness constraints for active queue and room membership, composite indexes for room status and leaderboard reads, immutable turn/result records, retention for raw room events, and no audio BLOBs in MySQL.

### API and event contracts

Add protected tRPC procedures for profile, queue, room creation/join/leave/ready, rematch, stats, leaderboards, and room history. Share Zod schemas between tRPC and WebSocket commands. Validate authorization, room membership, side, state version, deadline, transcript length, and idempotency on every mutation. Never render untrusted handles, motions, or transcripts without escaping/sanitization.

### Client and reconnect experience

Add Match, Room, Live Game, Result, Profile, Stats, and Leaderboards views using the existing app shell. Show opponent presence, server-synchronized clock, current side/round, connection state, mic/typed controls, submission acknowledgement, and reconnect banner. Keep drafts locally but never claim submission until acknowledged. On reconnect, reconcile by state version and idempotency key; server deadlines always win.

### Stats and leaderboards

Track games, wins, losses, draws, abandons, completion rate, rating, peak rating, rubric averages, side/category splits, response time, and streaks. Keep competitive human rating separate from solo AI practice. Launch opt-in all-time, monthly, friends/visible-profile, and category boards with minimum completed-game thresholds and stable tie-breakers. Exclude server-fault forfeits, cap gains against provisional opponents, flag repeated rematches, and make rating updates idempotent.

### Security and reliability

Rate-limit queue, room, reconnect, submission, rematch, and judging operations. Use short-lived invite tokens, origin checks, CSRF protection, authenticated WebSocket handshakes, safe room codes, transcript limits, moderation hooks, and admin appeals that do not mutate immutable records. Add telemetry for queue wait, match success, reconnects, timeouts, room errors, judge latency, fallback use, and leaderboard lag without logging keys or private transcripts.

### Delivery roadmap

**Phase 0:** Create the `multiplayer` branch, commit this roadmap, capture open decisions, and choose the hosting mode.

**Phase 1:** Add profiles, rulesets, schema/migrations, indexes, protected tRPC contracts, and authorization/idempotency tests.

**Phase 2:** Implement WebSocket handshake, room state machine, heartbeats, event versions, reconnect snapshots, event ledger, fake-clock tests, and restart recovery.

**Phase 3:** Implement Quick Match, private rooms, invite links, ready checks, server timers, turn submission, reconnect UI, results, and two-player browser tests.

**Phase 4:** Add Elo events, daily stats, privacy-aware seasonal leaderboards, reconciliation, abuse checks, and exactly-once accounting tests.

**Phase 5:** Load-test concurrent rooms within Reserved Hosting limits, test mobile browser behavior, audit privacy/security, add a feature flag, and run a staged multiplayer beta.

### Acceptance criteria

Two authenticated browser sessions must join one room, receive the same topic and opposite sides, complete all turns, survive a reconnect, and receive exactly one persisted result. Duplicate or stale commands must not advance state twice. A process restart must recover from durable state or produce a non-punitive termination. Tests must cover matching, authorization, ruleset compatibility, timers, reconnects, idempotency, abandonment, rating updates, redaction, rate limits, and load behavior.

### Decisions required before implementation

Confirm whether public Quick Match allows custom motions; whether AI judging is default or opt-in; whether leaderboards are opt-in; whether Reserved Hosting is acceptable for the beta; whether spectators/friends/tournaments are post-beta; and whether launch rating is Elo or confidence-aware. These decisions should be recorded as issues or an ADR on the branch before Phase 1 implementation.

### Definition of done

The branch contains this roadmap, approved ruleset and state contracts, reviewed migrations, selected hosting mode, a test matrix, and an explicit rollback plan. Multiplayer remains additive and feature-flagged until staged-beta evidence supports enabling it publicly.

## References

[1]: https://github.com/DTRHnet/debator "DTRHnet/debator repository"
[2]: https://manus.im "Manus platform"
[3]: https://openrouter.ai/docs "OpenRouter documentation"

**Author:** Manus AI  
**Planning date:** 2026-08-16  
**Target branch:** `multiplayer`

- [ ] Replace this history section with the final pushed roadmap path once the branch is created.

## Approved roadmap summary

The approved roadmap is intentionally additive: preserve solo mode; add authenticated multiplayer behind a feature flag; use a server-authoritative WebSocket room service; persist room, turn, rating, stats, and leaderboard data; match by compatible ruleset and expanding rating window; use Reserved Hosting for the first persistent realtime deployment; and harden with reconnect, idempotency, moderation, privacy, telemetry, load testing, and staged rollout.

- [ ] After branch creation, move the final roadmap into `docs/multiplayer-roadmap.md`.
- [ ] After push, add the branch commit hash to the delivery note.

## Multiplayer implementation plan

1. **Branch and document:** Create `multiplayer` from the current stable main branch and add the detailed roadmap under `docs/multiplayer-roadmap.md`.
2. **Contracts first:** Define ruleset, room snapshot, command, event, result, and leaderboard schemas, then add authorization and idempotency tests.
3. **Persistence:** Add the profile, queue, room, player, turn, result, rating-event, daily-stat, leaderboard, and room-event tables with safe additive migrations.
4. **Authoritative server:** Add a WebSocket room service with heartbeats, server timers, state versions, event replay, reconnect snapshots, and process-restart recovery.
5. **Matching:** Implement compatibility filtering, expanding rating windows, queue expiry, atomic pair claiming, self/rematch avoidance, ready checks, and side assignment.
6. **Game UI:** Add queue, room, live-game, reconnect, result, profile, stats, and leaderboard screens while retaining solo mode.
7. **Competitive layer:** Add Elo or selected rating system, immutable rating events, stats aggregation, privacy controls, and anti-abuse leaderboard rules.
8. **Launch hardening:** Load-test, test mobile/browser reconnect behavior, instrument queue and room health, stage behind a feature flag, and roll out gradually.

## Hosting decision note

WebDev Autoscale is appropriate for stateless solo play but not for an authoritative in-memory room process. Use Reserved Hosting for the low-volume beta, with the usage-based ceiling and egress considerations documented above. If concurrency exceeds the reserved instance, introduce shared state/event infrastructure and horizontally scalable WebSocket gateways rather than increasing local in-memory reliance.

## References

[1]: https://github.com/DTRHnet/debator "DTRHnet/debator repository"
[2]: https://manus.im "Manus platform"
[3]: https://openrouter.ai/docs "OpenRouter documentation"

- [ ] Confirm the final branch and docs path in the delivery summary.

## Multiplayer roadmap completion checklist

- [ ] Branch `multiplayer` created from the stable main baseline.
- [ ] Roadmap saved as `docs/multiplayer-roadmap.md`.
- [ ] Auth, matchmaking, room state, server controls, stats, and leaderboards specified.
- [ ] Reserved Hosting decision and scaling path specified.
- [ ] Security, privacy, abuse, testing, rollout, and rollback specified.
- [ ] Branch pushed to `DTRHnet/debator`.

## Implementation guardrails

- Do not change solo gameplay while adding multiplayer contracts.
- Do not trust client clocks or client-side side assignments.
- Do not persist audio bytes in database tables.
- Do not expose private OAuth identifiers or raw transcripts in public rankings.
- Make every room mutation idempotent and every result/rating update exactly once.
- Keep public matchmaking behind a feature flag until staging evidence passes.

## Final planning references

[1]: https://github.com/DTRHnet/debator "DTRHnet/debator repository"
[2]: https://manus.im "Manus platform"
[3]: https://openrouter.ai/docs "OpenRouter documentation"

**Target deliverable:** `docs/multiplayer-roadmap.md` on branch `multiplayer`.

- [ ] Commit roadmap document.
- [ ] Push branch to remote.
- [ ] Report branch URL and commit hash.

## Plan approved

Approved by the user in Plan Mode. Execution can begin with branch creation and roadmap commit.

## Final execution checklist

- [ ] Create branch.
- [ ] Add docs/multiplayer-roadmap.md.
- [ ] Commit docs.
- [ ] Push branch.
- [ ] Verify remote branch.

## Notes

This project plan deliberately separates the planning artifact from later implementation work. The first branch commit should contain documentation only; implementation should follow in reviewed phases.

## References

[1]: https://github.com/DTRHnet/debator "DTRHnet/debator repository"
[2]: https://manus.im "Manus platform"
[3]: https://openrouter.ai/docs "OpenRouter documentation"

- [ ] Replace this placeholder history with the final commit information after push.

## Roadmap governance

Any future change to matchmaking, rating, room authority, data retention, or public leaderboard visibility should update this document or add an ADR on the `multiplayer` branch before implementation.

## Branch deliverable

The intended first commit is documentation-only, named `docs: add multiplayer architecture roadmap`, and should be pushed to the remote `multiplayer` branch for review.

## Completion criteria

The planning task is complete when reviewers can understand the multiplayer product, choose controls, trace every server state transition, inspect the matching rules, understand data/privacy boundaries, estimate hosting implications, and execute the implementation phases without unresolved architectural ambiguity.

## Final references

[1]: https://github.com/DTRHnet/debator "DTRHnet/debator repository"
[2]: https://manus.im "Manus platform"
[3]: https://openrouter.ai/docs "OpenRouter documentation"

**Target branch:** `multiplayer`  
**Target file:** `docs/multiplayer-roadmap.md`  
**Status:** Approved for execution.

- [ ] Execute branch/document creation and push.

## End

This checklist is intentionally retained as project history; completed items should be marked `[x]` after execution.
