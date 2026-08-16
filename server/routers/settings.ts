import { z } from "zod";
import { encryptSecret } from "../crypto";
import { getUserSettings, upsertUserSettings } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { DEFAULT_FREE_MODEL, FREE_MODEL_IDS } from "../../shared/freeModels";

const defaults = { timerSeconds: 60, roundCount: 1, preferredModel: DEFAULT_FREE_MODEL };

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
      preferredModel: z.string().trim().refine(model => FREE_MODEL_IDS.includes(model as typeof FREE_MODEL_IDS[number]), {
        message: "Choose a currently listed OpenRouter free-model slug.",
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
