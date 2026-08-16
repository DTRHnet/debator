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
- Final commit: `f000a3f4687c3cb9dcb96d2d984b6791f5233391`
- Remote: https://github.com/DTRHnet/debator/tree/multiplayer
- Scope: documentation-only multiplayer planning; multiplayer runtime implementation remains future work described by the roadmap.

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
