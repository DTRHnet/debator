import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ENV } from "../_core/env";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getPlayerProfile, upsertPlayerProfile } from "../db";
import { multiplayerProfileSchema, multiplayerRulesetSchema } from "../../shared/multiplayer";

const fallbackHandle = (name: string | null | undefined, userId: number) => {
  const base = (name ?? "Debater").replace(/[^a-zA-Z0-9_ -]/g, "").trim().replace(/\s+/g, "-").slice(0, 16) || "Debater";
  return `${base}-${userId}`.slice(0, 24);
};

const requireEnabled = () => {
  if (!ENV.multiplayerEnabled) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Multiplayer is not enabled yet." });
  }
};

export const multiplayerRouter = router({
  config: publicProcedure.query(() => ({
    enabled: ENV.multiplayerEnabled,
    phase: "competitive-results" as const,
    supportedModes: ["quick_match", "private_room"] as const,
    ruleset: {
      modes: ["quick_match", "private_room"] as const,
      topicSources: ["random", "category", "pack", "custom"] as const,
      timerSeconds: [30, 45, 60, 90] as const,
      roundCounts: [1, 2, 3] as const,
      inputModes: ["microphone", "typed", "either"] as const,
    },
  })),

  profile: protectedProcedure.query(async ({ ctx }) => {
    requireEnabled();
    const profile = await getPlayerProfile(ctx.user.id);
    return {
      handle: profile?.handle ?? fallbackHandle(ctx.user.name, ctx.user.id),
      isPublic: profile ? profile.isPublic === 1 : true,
      preferredCategory: profile?.preferredCategory ?? null,
      saved: Boolean(profile),
    };
  }),

  saveProfile: protectedProcedure
    .input(multiplayerProfileSchema.extend({
      preferredCategory: z.string().trim().max(64).nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireEnabled();
      await upsertPlayerProfile({
        userId: ctx.user.id,
        handle: input.handle.trim(),
        isPublic: input.isPublic ? 1 : 0,
        preferredCategory: input.preferredCategory?.trim() || null,
      });
      return { success: true, ...input };
    }),
});
