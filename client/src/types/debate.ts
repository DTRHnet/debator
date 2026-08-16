export type SideScore = {
  totalScore: number;
  clarity: number;
  argumentStrength: number;
  structure: number;
  delivery: number;
  strengths: string[];
  improvements: string[];
};

export type DebateVerdict = {
  winner: "pro" | "con" | "draw";
  overallSummary: string;
  pro: SideScore;
  con: SideScore;
};
