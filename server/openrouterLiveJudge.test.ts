import { describe, expect, it } from "vitest";
import { DEFAULT_FREE_MODEL } from "../shared/freeModels";
import { judgeDebate } from "./debateJudge";

const runLiveJudge = process.env.RUN_OPENROUTER_LIVE === "1";

describe("OpenRouter live debate verdict", () => {
  it.runIf(runLiveJudge)("returns a structured verdict from the configured default model", async () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    expect(apiKey).toBeTruthy();
    const verdict = await judgeDebate({
      apiKey: apiKey!,
      model: DEFAULT_FREE_MODEL,
      topic: "Should public transit be free for all riders?",
      proTranscript: "Free transit removes a cost barrier for workers and students while reducing urban congestion.",
      conTranscript: "Free service must be funded sustainably, so targeted subsidies may offer better value than universal access.",
    });
    expect(["pro", "con", "draw"]).toContain(verdict.winner);
    expect(verdict.pro.totalScore).toBeGreaterThanOrEqual(0);
  }, 45_000);
});
