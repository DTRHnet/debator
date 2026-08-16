import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const authenticatedContext = {
  user: { id: 7, openId: "phase2-user", email: "phase2@example.com", name: "Phase 2 User", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
} as TrpcContext;

const anonymousContext = {
  user: undefined,
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
} as TrpcContext;

describe("multiplayer runtime authorization", () => {
  it("rejects anonymous queue access before touching persistence", async () => {
    const caller = appRouter.createCaller(anonymousContext);
    await expect(caller.multiplayer.queueStatus()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects anonymous room access", async () => {
    const caller = appRouter.createCaller(anonymousContext);
    await expect(caller.multiplayer.room({ roomId: "room_12345678" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects authenticated runtime access while the feature flag is disabled", async () => {
    const caller = appRouter.createCaller(authenticatedContext);
    await expect(caller.multiplayer.queueStatus()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller.multiplayer.cancel()).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("keeps the public config available while runtime mutations remain protected", async () => {
    const caller = appRouter.createCaller(anonymousContext);
    const config = await caller.multiplayer.config();
    expect(config.enabled).toBe(false);
    await expect(caller.multiplayer.cancel()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
