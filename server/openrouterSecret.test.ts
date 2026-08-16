import { describe, expect, it } from "vitest";

describe("OpenRouter server credential", () => {
  it("authenticates against the OpenRouter key-inspection endpoint", async () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.ok).toBe(true);
  }, 15_000);
});
