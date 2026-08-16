import { describe, expect, it } from "vitest";
import { appendRecentTopic, chooseTopic, TOPIC_CATEGORIES, TOPICS } from "../client/src/lib/topics";
import { DEFAULT_FREE_MODEL, FREE_MODEL_IDS, FREE_MODEL_OPTIONS } from "../shared/freeModels";

describe("DebateRush enhanced catalogue", () => {
  it("ships at least two hundred unique motions across the expanded category set", () => {
    expect(TOPICS.length).toBeGreaterThanOrEqual(200);
    expect(new Set(TOPICS.map(topic => topic.id)).size).toBe(TOPICS.length);
    expect(TOPIC_CATEGORIES).toEqual(expect.arrayContaining(["Random", "Law & Rights", "Global Affairs", "Arts & Design"]));
    for (const category of TOPIC_CATEGORIES.filter(category => category !== "All" && category !== "Random")) {
      expect(TOPICS.filter(topic => topic.category === category)).toHaveLength(10);
    }
  });

  it("limits selectable settings models to reviewed free structured-output choices", () => {
    expect(FREE_MODEL_OPTIONS.length).toBeGreaterThanOrEqual(6);
    expect(FREE_MODEL_OPTIONS.every(model => model.structured && model.id.endsWith(":free"))).toBe(true);
    expect(FREE_MODEL_IDS).toContain(DEFAULT_FREE_MODEL);
  });

  it("excludes recently used questions while supporting both category and all-topic random modes", () => {
    const societyTopic = TOPICS.find(topic => topic.category === "Society");
    expect(societyTopic).toBeDefined();

    const categoryChoice = chooseTopic("Society", [societyTopic!.id], () => 0);
    const randomChoice = chooseTopic("Random", [categoryChoice.id], () => 0);

    expect(categoryChoice.category).toBe("Society");
    expect(categoryChoice.id).not.toBe(societyTopic!.id);
    expect(randomChoice.id).not.toBe(categoryChoice.id);
    expect(appendRecentTopic(["one", "two", "three"], "two", 3)).toEqual(["one", "three", "two"]);
  });
});
