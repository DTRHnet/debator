import { z } from "zod";
import { encryptSecret } from "../crypto";
import { getUserSettings, upsertUserSettings } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const defaults = { timerSeconds: 60, roundCount: 1, preferredModel: "google/gemma-3-27b-it:free" };

export const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const settings = await getUserSettings(ctx.user.id);
    return {
      timerSeconds: settings?.timerSeconds ?? defaults.timerSeconds,
      roundCount: settings?.roundCount ?? defaults.roundCount,
      preferredModel: settings?.preferredModel ?? defaults.preferredModel,
      hasOpenRouterKey: Boolean(settings?.encryptedOpenRouterKey),
      keyLastFour: settings?.keyLastFour ?? null,
    };
  }),

  save: protectedProcedure
    .input(z.object({
      timerSeconds: z.number().int().min(15).max(300),
      roundCount: z.number().int().min(1).max(5),
      preferredModel: z.string().trim().min(3).max(160).refine(model => model.endsWith(":free"), {
        message: "DebateRush accepts OpenRouter free-model slugs only.",
      }),
      openRouterKey: z.string().trim().min(16).max(300).optional(),
      clearOpenRouterKey: z.boolean().default(false),
    }).refine(input => !(input.openRouterKey && input.clearOpenRouterKey), {
      message: "Provide a new key or clear the existing key, not both.",
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getUserSettings(ctx.user.id);
      const normalizedKey = input.openRouterKey?.trim();
      const encryptedOpenRouterKey = input.clearOpenRouterKey
        ? null
        : normalizedKey
          ? encryptSecret(normalizedKey)
          : existing?.encryptedOpenRouterKey ?? null;
      const keyLastFour = input.clearOpenRouterKey
        ? null
        : normalizedKey
          ? normalizedKey.slice(-4)
          : existing?.keyLastFour ?? null;

      await upsertUserSettings({
        userId: ctx.user.id,
        timerSeconds: input.timerSeconds,
        roundCount: input.roundCount,
        preferredModel: input.preferredModel,
        encryptedOpenRouterKey,
        keyLastFour,
      });
      return { success: true, hasOpenRouterKey: Boolean(encryptedOpenRouterKey), keyLastFour };
    }),
});
