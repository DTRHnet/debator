import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserSettings: vi.fn(),
  upsertDebateSession: vi.fn(),
  judgeDebate: vi.fn(),
}));

vi.mock("./db", () => ({ getUserSettings: mocks.getUserSettings, upsertDebateSession: mocks.upsertDebateSession }));
vi.mock("./debateJudge", async importOriginal => {
  const actual = await importOriginal<typeof import("./debateJudge")>();
  return { ...actual, judgeDebate: mocks.judgeDebate };
});

import { debateRouter } from "./routers/debate";

const verdict = {
  winner: "pro" as const,
  overallSummary: "The Pro side connected its points more clearly.",
  pro: { totalScore: 82, clarity: 84, argumentStrength: 81, structure: 80, delivery: 83, strengths: ["Clear claim"], improvements: ["Address counterarguments"] },
  con: { totalScore: 77, clarity: 79, argumentStrength: 75, structure: 78, delivery: 76, strengths: ["Useful example"], improvements: ["Develop the evidence"] },
};

describe("app-wide OpenRouter judging fallback", () => {
  beforeEach(() => {
    mocks.getUserSettings.mockReset();
    mocks.upsertDebateSession.mockReset();
    mocks.judgeDebate.mockReset();
    process.env.OPENROUTER_API_KEY = "server-level-test-key";
    mocks.getUserSettings.mockResolvedValue(undefined);
    mocks.judgeDebate.mockResolvedValue(verdict);
  });

  it("uses the configured server key when the user has not saved a personal key", async () => {
    const caller = debateRouter.createCaller({ user: { id: 42 } } as never);
    const result = await caller.judge({
      id: "2ed5d931-51f7-4a67-b645-dc0f793c3e0e",
      topic: "Should public transit be free for all riders?",
      topicSource: "random",
      timerSeconds: 60,
      roundCount: 1,
      proTranscript: "Free transit reduces barriers to work and school.",
      conTranscript: "The cost must be funded sustainably.",
    });

    expect(mocks.judgeDebate).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "server-level-test-key" }));
    expect(mocks.upsertDebateSession).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, status: "complete" }));
    expect(result).toMatchObject({ status: "complete", verdict });
  });
});
