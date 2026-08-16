import { z } from "zod";

export const multiplayerRulesetSchema = z.object({
  mode: z.enum(["quick_match", "private_room"]),
  topicSource: z.enum(["random", "category", "pack", "custom"]),
  category: z.string().trim().min(1).max(64).nullable(),
  timerSeconds: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
  roundCount: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  inputMode: z.enum(["microphone", "typed", "either"]),
  aiAnalysis: z.boolean(),
});

export type MultiplayerRuleset = z.infer<typeof multiplayerRulesetSchema>;

export const multiplayerProfileSchema = z.object({
  handle: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_ -]+$/),
  isPublic: z.boolean(),
  preferredCategory: z.string().trim().max(64).nullable(),
});

export type MultiplayerProfile = z.infer<typeof multiplayerProfileSchema>;

export const multiplayerPhase = "identity-and-contracts" as const;


export const multiplayerRoomStateSchema = z.enum([
  "waiting",
  "ready",
  "countdown",
  "speaking",
  "turn_submitted",
  "round_complete",
  "judging",
  "completed",
  "abandoned",
  "expired",
  "cancelled",
]);

export type MultiplayerRoomState = z.infer<typeof multiplayerRoomStateSchema>;

export const multiplayerRoomSnapshotSchema = z.object({
  roomId: z.string().min(8).max(64),
  state: multiplayerRoomStateSchema,
  stateVersion: z.number().int().nonnegative(),
  serverNow: z.number().int().nonnegative(),
  topic: z.string().trim().min(1).max(280),
  ruleset: multiplayerRulesetSchema,
  round: z.number().int().min(1).max(3),
  activeSide: z.enum(["pro", "con"]).nullable(),
  players: z.array(z.object({
    userId: z.number().int().positive(),
    handle: z.string().min(1).max(24),
    side: z.enum(["pro", "con"]),
    connected: z.boolean(),
    ready: z.boolean(),
  })).max(2),
  deadlineAt: z.number().int().nonnegative().nullable(),
});

export type MultiplayerRoomSnapshot = z.infer<typeof multiplayerRoomSnapshotSchema>;

export const multiplayerClientCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready"), idempotencyKey: z.string().uuid() }),
  z.object({ type: z.literal("submit_turn"), idempotencyKey: z.string().uuid(), stateVersion: z.number().int().nonnegative(), transcript: z.string().trim().max(20_000) }),
  z.object({ type: z.literal("leave_room"), idempotencyKey: z.string().uuid() }),
  z.object({ type: z.literal("request_snapshot"), lastEventId: z.number().int().nonnegative().nullable() }),
]);

export type MultiplayerClientCommand = z.infer<typeof multiplayerClientCommandSchema>;

export const multiplayerServerEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("room_snapshot"), eventId: z.number().int().nonnegative(), snapshot: multiplayerRoomSnapshotSchema }),
  z.object({ type: z.literal("presence"), eventId: z.number().int().nonnegative(), userId: z.number().int().positive(), connected: z.boolean() }),
  z.object({ type: z.literal("countdown"), eventId: z.number().int().nonnegative(), startsAt: z.number().int().nonnegative() }),
  z.object({ type: z.literal("turn_started"), eventId: z.number().int().nonnegative(), side: z.enum(["pro", "con"]), round: z.number().int().min(1).max(3), deadlineAt: z.number().int().nonnegative() }),
  z.object({ type: z.literal("turn_ended"), eventId: z.number().int().nonnegative(), side: z.enum(["pro", "con"]), round: z.number().int().min(1).max(3) }),
  z.object({ type: z.literal("opponent_submitted"), eventId: z.number().int().nonnegative(), side: z.enum(["pro", "con"]), round: z.number().int().min(1).max(3) }),
  z.object({ type: z.literal("judging_started"), eventId: z.number().int().nonnegative() }),
  z.object({ type: z.literal("result_ready"), eventId: z.number().int().nonnegative(), resultId: z.string().min(1).max(64) }),
  z.object({ type: z.literal("error"), eventId: z.number().int().nonnegative(), code: z.string().min(1).max(64), message: z.string().min(1).max(240) }),
]);

export type MultiplayerServerEvent = z.infer<typeof multiplayerServerEventSchema>;


export type MultiplayerAvailabilityState = "loading" | "error" | "disabled" | "enabled";

export function getMultiplayerAvailabilityState(input: {
  isLoading: boolean;
  hasError: boolean;
  enabled: boolean;
}): MultiplayerAvailabilityState {
  if (input.isLoading) return "loading";
  if (input.hasError) return "error";
  return input.enabled ? "enabled" : "disabled";
}
