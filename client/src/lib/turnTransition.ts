import type { DebateSide } from "./turnAnnouncement";

export type DebateTurnTransition =
  | { kind: "next"; side: DebateSide; round: number }
  | { kind: "judge" };

export function advanceDebateTurn(side: DebateSide, round: number, roundCount: number): DebateTurnTransition {
  if (side === "pro") return { kind: "next", side: "con", round };
  if (round < roundCount) return { kind: "next", side: "pro", round: round + 1 };
  return { kind: "judge" };
}
