import { describe, expect, it } from "vitest";
import { buildJudgePrompt, cleanModelJson, judgeDebate, verdictSchema } from "./debateJudge";
import { vi } from "vitest";

describe("debate judging utilities", () => {
  it("removes a fenced JSON response before parsing", () => {
    expect(cleanModelJson("```json\n{\"winner\":\"draw\"}\n```")).toBe('{"winner":"draw"}');
  });

  it("builds a prompt that includes both sides and the topic", () => {
    const prompt = buildJudgePrompt("Should cities ban cars?", "Cleaner streets.", "Public transit is limited.");
    expect(prompt).toContain("Should cities ban cars?");
    expect(prompt).toContain("Cleaner streets.");
    expect(prompt).toContain("Public transit is limited.");
  });

  it("rejects verdicts with scores outside the 0–100 scale", () => {
    const invalid = { winner: "pro", overallSummary: "Summary", pro: {}, con: {} };
    expect(() => verdictSchema.parse(invalid)).toThrow();
  });

  it("retries a second curated free model when the selected provider is rate-limited", async () => {
    const verdict = { winner: "draw", overallSummary: "Both sides made useful points.", pro: { totalScore: 70, clarity: 70, argumentStrength: 70, structure: 70, delivery: 70, strengths: ["Clear claim"], improvements: ["Add evidence"] }, con: { totalScore: 70, clarity: 70, argumentStrength: 70, structure: 70, delivery: 70, strengths: ["Clear response"], improvements: ["Add evidence"] } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(verdict) } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await judgeDebate({ apiKey: "test", model: "google/gemma-4-26b-a4b-it:free", topic: "Topic", proTranscript: "Pro", conTranscript: "Con" });
    expect(result.winner).toBe("draw");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string).model).not.toBe("google/gemma-4-26b-a4b-it:free");
    vi.unstubAllGlobals();
  });
});
