import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getMultiplayerAvailabilityState, multiplayerClientCommandSchema, multiplayerProfileSchema, multiplayerRoomStateSchema, multiplayerRulesetSchema } from "../shared/multiplayer";

const context = { user: undefined, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;

describe("multiplayer Phase 1 foundation", () => {
  it("keeps multiplayer disabled unless the server flag is explicitly enabled", async () => {
    const config = await appRouter.createCaller(context).multiplayer.config();
    expect(config.enabled).toBe(false);
    expect(config.supportedModes).toEqual(["quick_match", "private_room"]);
  });

  it("accepts only bounded launch rulesets", () => {
    expect(multiplayerRulesetSchema.parse({
      mode: "quick_match",
      topicSource: "random",
      category: null,
      timerSeconds: 60,
      roundCount: 1,
      inputMode: "either",
      aiAnalysis: true,
    })).toMatchObject({ mode: "quick_match", timerSeconds: 60 });

    expect(() => multiplayerRulesetSchema.parse({
      mode: "quick_match",
      topicSource: "random",
      category: null,
      timerSeconds: 17,
      roundCount: 1,
      inputMode: "either",
      aiAnalysis: true,
    })).toThrow();
  });

  it("covers loading, error, disabled, and enabled availability states", () => {
    expect(getMultiplayerAvailabilityState({ isLoading: true, hasError: false, enabled: false })).toBe("loading");
    expect(getMultiplayerAvailabilityState({ isLoading: false, hasError: true, enabled: false })).toBe("error");
    expect(getMultiplayerAvailabilityState({ isLoading: false, hasError: false, enabled: false })).toBe("disabled");
    expect(getMultiplayerAvailabilityState({ isLoading: false, hasError: false, enabled: true })).toBe("enabled");
  });

  it("validates room states and idempotent client commands", () => {
    expect(multiplayerRoomStateSchema.parse("speaking")).toBe("speaking");
    expect(multiplayerClientCommandSchema.parse({ type: "ready", idempotencyKey: "00000000-0000-4000-8000-000000000000" }).type).toBe("ready");
    expect(() => multiplayerClientCommandSchema.parse({ type: "submit_turn", idempotencyKey: "not-a-uuid", stateVersion: 0, transcript: "draft" })).toThrow();
  });

  it("validates public handles and privacy fields", () => {
    expect(multiplayerProfileSchema.parse({ handle: "calm-debater", isPublic: true, preferredCategory: "Society" }).isPublic).toBe(true);
    expect(() => multiplayerProfileSchema.parse({ handle: "<script>", isPublic: true, preferredCategory: null })).toThrow();
  });
});
