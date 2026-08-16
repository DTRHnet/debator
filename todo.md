# Project TODO

## DebateRush baseline history

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

## Multiplayer planning deliverable

- [x] Create the `multiplayer` branch and add the detailed multiplayer architecture roadmap under `docs/multiplayer-roadmap.md`.
- [x] Specify Manus OAuth identity, randomized skill-aware matching, private room hosting, server-authoritative state, WebSocket events, reconnect behavior, stats, leaderboards, security, testing, rollout, and rollback.
- [x] Specify an additive feature-flag rollout so solo play remains unchanged until multiplayer launch readiness is verified. This is a planning decision, not an implemented feature.
- [x] Record the Reserved Hosting decision, usage-based cost ceiling, scaling path, and persistent-room constraints.
- [x] Push the `multiplayer` branch to `DTRHnet/debator`.
- [x] Record the final remote branch URL and documentation commit in the roadmap.

## Delivery record

- Branch: `multiplayer`
- Roadmap: `docs/multiplayer-roadmap.md`
- Final commit: `599113525cc3ee9a759aa165fc5a71621d1903d8`
- Remote: https://github.com/DTRHnet/debator/tree/multiplayer
- Scope: multiplayer Phase 1–3 implementation is feature-gated; solo play remains the default, with realtime transport enabled only in staging via explicit server flags.

## References

- [DTRHnet/debator](https://github.com/DTRHnet/debator)
- [Manus](https://manus.im)
- [OpenRouter documentation](https://openrouter.ai/docs)

## Multiplayer Phase 1 implementation

- [x] Add a server-controlled multiplayer feature flag that defaults off and preserves solo play.
- [x] Add shared multiplayer ruleset, profile, and room-contract types with validation helpers.
- [x] Add additive authenticated player-profile persistence and APIs.
- [x] Add the first flagged multiplayer entry/profile experience without exposing unfinished matchmaking.
- [x] Add Phase 1 tests, migration verification, checkpoint, and branch push.

Scope note: this phase establishes identity and contracts only; realtime rooms and matchmaking remain subsequent phases from `docs/multiplayer-roadmap.md`.

- [x] Add shared multiplayer room snapshot, state, command, and event schemas for future realtime phases.
- [x] Add config/profile loading and error states so the gated multiplayer page never shows a false disabled state while queries are unresolved.
- [x] Add regression coverage for multiplayer configuration behavior across disabled, enabled, loading, and error states.

## Multiplayer Phase 2 runtime implementation

- [x] Add persistent matchmaking queue and room tables with additive migration.
- [x] Implement server-authoritative queue join/leave and deterministic two-player matching helpers.
- [x] Implement room lifecycle state transitions, host controls, idempotency, and reconnect-safe snapshots.
- [x] Add protected tRPC procedures for queue and room controls behind the multiplayer flag.
- [x] Build gated queue and room-control UI while preserving solo gameplay.
- [x] Add regression tests for queue matching, room transitions, authorization, and idempotency.
- [x] Run migration review, tests, type check, production build, checkpoint, and push to `multiplayer`.

- [x] Implement host authorization and stronger server-authoritative room lifecycle controls with durable snapshot/event replay.
- [x] Fix room transcript editing so players can type before submit, then verify the room UI.
- [x] Add router-level authorization, feature-flag, and duplicate-submission regression tests.

- [x] Add durable room replay/recovery coverage and complete authoritative lifecycle handling beyond basic event fetches.
- [x] Verify the room UI after the transcript-editing fix at the rendered route.
- [x] Add router-level duplicate-submission idempotency and disabled-runtime feature-flag tests.

- [x] Integrate durable event reconciliation into the actual room load path and test restart recovery behavior.
- [x] Add a router-path duplicate submit test using the same idempotency key and verify no second state advance.
- [x] Keep room UI verification explicit about the feature-flagged disabled state until an enabled test fixture is available.

## Multiplayer Phase 3 realtime transport

- [x] Add authenticated, feature-flagged realtime room transport with a safe connection lifecycle.
- [x] Add server-owned presence, heartbeat, disconnect, reconnect snapshot, and event-version contracts.
- [x] Integrate client room synchronization with realtime events while retaining polling fallback.
- [x] Add authorization, reconnect, heartbeat, and transport contract tests, then run the production build.
- [x] Checkpoint and push the realtime increment to `DTRHnet/debator`.

## Multiplayer Phase 3 hardening follow-up

- [x] Tighten realtime replay and room-event schemas with explicit event-versioned payloads.
- [x] Prevent stale sockets from marking a player disconnected while another live socket remains.
- [x] Add integration coverage for unauthorized upgrades, authenticated joins, replay reconnects, and heartbeat cleanup.
- [x] Create the realtime checkpoint, push `multiplayer`, and record commit evidence.

## Multiplayer Phase 3 integration-test completion

- [x] Add an authenticated WebSocket join test with an authoritative room snapshot.
- [x] Add a reconnect test using `lastEventId` and verify missed event replay.
- [x] Add heartbeat timeout cleanup coverage for presence and persisted connection state.

## Multiplayer Phase 4 competitive results and leaderboards

- [x] Add durable match results, player rating updates, and leaderboard query contracts.
- [x] Add server-authoritative completed-room result finalization with idempotency and authorization.
- [x] Add feature-gated match-result and leaderboard UI without affecting solo practice.
- [x] Add regression coverage for finalization, rating math, authorization, ranking, and duplicate requests.
- [ ] Run full validation, checkpoint, and push the competitive multiplayer increment.
