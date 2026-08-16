import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDebateSessions, getUserSettings, upsertDebateSession } from "../db";
import { decryptSecret } from "../crypto";
import { judgeDebate, verdictSchema } from "../debateJudge";
import { protectedProcedure, router } from "../_core/trpc";
import { DEFAULT_FREE_MODEL } from "../../shared/freeModels";

const sessionInput = z.object({
  id: z.string().uuid(),
  topic: z.string().trim().min(3).max(500),
  topicSource: z.enum(["random", "custom"]),
  timerSeconds: z.number().int().min(15).max(300),
  roundCount: z.number().int().min(1).max(5),
  proTranscript: z.string().max(12000),
  conTranscript: z.string().max(12000),
});

export const debateRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(({ ctx, input }) => getDebateSessions(ctx.user.id, input?.limit ?? 20)),

  saveOffline: protectedProcedure
    .input(sessionInput.extend({ verdict: verdictSchema.nullable().optional(), status: z.enum(["pending", "unavailable", "failed", "complete"]).default("pending") }))
    .mutation(async ({ ctx, input }) => {
      await upsertDebateSession({
        ...input,
        userId: ctx.user.id,
        verdict: input.verdict ?? null,
        status: input.verdict ? "complete" : input.status,
      });
      return { id: input.id, status: input.verdict ? "complete" : input.status };
    }),

  judge: protectedProcedure.input(sessionInput).mutation(async ({ ctx, input }) => {
    const settings = await getUserSettings(ctx.user.id);
    const apiKey = settings?.encryptedOpenRouterKey ? decryptSecret(settings.encryptedOpenRouterKey) : process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      await upsertDebateSession({ ...input, userId: ctx.user.id, verdict: null, status: "unavailable" });
      return { id: input.id, status: "unavailable" as const, message: "AI judging is not configured yet. Add an OpenRouter key in Settings to continue." };
    }

    try {
      const verdict = await judgeDebate({
        apiKey,
        topic: input.topic,
        proTranscript: input.proTranscript,
        conTranscript: input.conTranscript,
        model: settings?.preferredModel ?? DEFAULT_FREE_MODEL,
      });
      await upsertDebateSession({ ...input, userId: ctx.user.id, verdict, status: "complete" });
      return { id: input.id, status: "complete" as const, verdict };
    } catch (error) {
      await upsertDebateSession({ ...input, userId: ctx.user.id, verdict: null, status: "failed" });
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: error instanceof Error ? error.message : "AI evaluation failed.",
      });
    }
  }),
});
