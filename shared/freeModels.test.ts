import { describe, expect, it } from "vitest";
import { DEFAULT_FREE_MODEL, FREE_MODEL_IDS, FREE_MODEL_OPTIONS } from "./freeModels";

describe("reviewed free OpenRouter model catalogue", () => {
  it("keeps every configured option on the OpenRouter free tier", () => {
    expect(FREE_MODEL_OPTIONS.length).toBeGreaterThanOrEqual(6);
    expect(FREE_MODEL_IDS.every(id => id.endsWith(":free"))).toBe(true);
    expect(FREE_MODEL_IDS).toContain(DEFAULT_FREE_MODEL);
  });

  it("identifies at least one model that advertises structured output support", () => {
    expect(FREE_MODEL_OPTIONS.every(model => model.structured)).toBe(true);
  });
});
