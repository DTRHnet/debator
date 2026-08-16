import { describe, expect, it } from "vitest";
import { TOPIC_CATEGORIES, TOPICS } from "./topics";

describe("DebateRush topic catalogue", () => {
  it("provides a broad catalogue with many categories", () => {
    expect(TOPICS.length).toBeGreaterThanOrEqual(200);
    expect(TOPIC_CATEGORIES).toContain("Random");
    expect(TOPIC_CATEGORIES).toContain("Law & Rights");
    expect(TOPIC_CATEGORIES).toContain("Arts & Design");
  });

  it("assigns a unique identifier to every question", () => {
    expect(new Set(TOPICS.map(topic => topic.id)).size).toBe(TOPICS.length);
  });
});
