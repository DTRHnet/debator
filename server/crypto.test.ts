import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

const originalSecret = process.env.JWT_SECRET;

beforeEach(() => {
  process.env.JWT_SECRET = "test-session-secret-for-debaterush";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

describe("optional API-key encryption", () => {
  it("round-trips a secret without retaining its plaintext in the ciphertext", () => {
    const secret = "sk-or-v1-example-secret-value";
    const encrypted = encryptSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("fails safely when encrypted payload segments are incomplete", () => {
    expect(() => decryptSecret("not-a-valid-payload")).toThrow("Stored credential is invalid.");
  });
});
