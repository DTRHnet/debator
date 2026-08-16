# DebateRush

DebateRush is a mobile-first Progressive Web App for practicing structured debates. A player chooses a random or custom motion, argues the **Pro** and **Con** positions through timed rounds, captures a live transcript where the browser supports it, and receives an optional structured AI verdict. Signed-in users retain their settings and session history in the application database.

| Capability | Implementation |
|---|---|
| Debate format | Configurable 30/45/60/90-second speaking turns, one to three rounds per side, Pro/Con round manager, random or custom topics |
| Speech capture | Web Speech live transcript when available; MediaRecorder preserves a local playable audio capture for every mic-enabled turn; typed arguments work everywhere |
| AI verdict | Authenticated server-side OpenRouter proxy, JSON-schema request with a validated JSON fallback, and per-side scores for clarity, argument strength, structure, and delivery |
| Accounts and history | Manus OAuth authentication; database-backed settings and debate-session history, scoped to the signed-in user |
| Offline behavior | Service worker caches the application shell after first use; gameplay can continue offline and completed sessions queue locally for account synchronization when online |

## Local development

The managed project already includes database and Manus OAuth configuration. Install dependencies, then start the local development server with the following commands.

```bash
pnpm install
pnpm dev
```

Run the automated checks before opening a pull request or publishing a checkpoint.

```bash
pnpm test
pnpm check
pnpm build
```

## OpenRouter setup

No OpenRouter secret belongs in a repository or client-side environment variable. DebateRush can use an optional app-wide server key for signed-in players, while a player may still open **Settings**, create a key from the [OpenRouter key page][1], and save a personal override. Personal keys are encrypted with the project session secret before database storage; the browser retains only the final four characters for confirmation.

The Settings panel lists only the reviewed free text-instruction models that currently advertise structured-output support: `google/gemma-4-26b-a4b-it:free`, `openai/gpt-oss-20b:free`, `nvidia/nemotron-nano-9b-v2:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `liquid/lfm-2.5-2.6b:free`, and `dots-studio/dots-3-note-preview:free`. DebateRush first asks OpenRouter for a strict JSON-schema response and validates it server-side. If a free endpoint does not support structured output parameters, the proxy makes a second constrained JSON request and validates the response before saving it. OpenRouter authenticates API calls with a bearer token and accepts requests at its chat-completions endpoint.[2] Its structured-output feature is configured through `response_format` with a JSON schema, though availability differs between model endpoints.[3]

> **Security note:** Do not place an OpenRouter key in `client/`, commit an `.env` secret, or expose it through a `VITE_*` variable. The app’s judging calls are made only from the server.

## Environment example

The app does **not** require a user-managed `.env` file in the default managed environment. Manus supplies database, OAuth, and server session configuration. The application intentionally stores a user-provided OpenRouter key through the authenticated Settings screen rather than reading one from a frontend environment variable.

```dotenv
# No application secrets should be committed here.
# Configure your OpenRouter key through Settings after signing in.
```

## Project layout

```text
client/src/pages/       Debate, history, and settings interfaces
client/src/hooks/       Browser speech-recognition and MediaRecorder capture
client/src/lib/         Topic bank and offline queue utilities
client/public/          PWA manifest and service worker
server/routers/         Authenticated settings and debate tRPC APIs
server/debateJudge.ts   OpenRouter request, JSON schema, and verdict validation
server/crypto.ts        Server-side AES-GCM encryption for the optional API key
drizzle/schema.ts       User settings and persisted debate-session tables
```

## Offline boundaries

The installed app can launch and run the **core practice loop** offline after the application shell has been cached by the service worker. Browser speech recognition may itself require network access in some browsers; DebateRush still permits typed arguments and retains a local MediaRecorder audio capture. AI judging requires an online connection and an available OpenRouter key. Offline completed sessions are stored locally, then synchronized to the authenticated account on a later online visit.

## Source repository note

The requested `DTRHnet/debator` repository was cloned before implementation. At the time of inspection, it contained only its repository README, so DebateRush is implemented from the supplied product specification within this managed application scaffold.

## References

[1]: https://openrouter.ai/keys "OpenRouter API keys"
[2]: https://openrouter.ai/docs/api_reference/authentication "OpenRouter authentication documentation"
[3]: https://openrouter.ai/docs/guides/features/structured-outputs "OpenRouter structured outputs documentation"
