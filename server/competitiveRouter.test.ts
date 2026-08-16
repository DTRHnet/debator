import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { ENV } from "./_core/env";

const userContext = {
  user: { id: 7, openId: "competitive-user", email: "competitive@example.com", name: "Competitive User", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
} as TrpcContext;
const anonymousContext = { user: undefined, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
const input = { roomId: "room_12345678", finalizationKey: "final-key-123" };

describe("competitive result router", () => {
  it("requires authentication and the multiplayer flag for server judging", async () => {
    const anonymous = appRouter.createCaller(anonymousContext);
    await expect(anonymous.multiplayer.judge(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const previous = ENV.multiplayerEnabled;
    ENV.multiplayerEnabled = false;
    const authenticated = appRouter.createCaller(userContext);
    await expect(authenticated.multiplayer.judge(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    ENV.multiplayerEnabled = previous;
  });

});
