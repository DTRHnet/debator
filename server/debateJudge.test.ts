import { describe, expect, it } from "vitest";
import { buildJudgePrompt, cleanModelJson, verdictSchema } from "./debateJudge";

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
});
