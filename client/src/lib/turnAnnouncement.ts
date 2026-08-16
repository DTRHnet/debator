export type DebateSide = "pro" | "con";

export function turnAnnouncementText(side: DebateSide, round: number) {
  return `Round ${round}. ${side === "pro" ? "Pro" : "Con"} speaker, you have the floor.`;
}
