import { z } from "zod";

export const verdictSchema = z.object({
  winner: z.enum(["pro", "con", "draw"]),
  overallSummary: z.string().min(1).max(900),
  pro: z.object({
    totalScore: z.number().int().min(0).max(100),
    clarity: z.number().int().min(0).max(100),
    argumentStrength: z.number().int().min(0).max(100),
    structure: z.number().int().min(0).max(100),
    delivery: z.number().int().min(0).max(100),
    strengths: z.array(z.string().min(1).max(180)).min(1).max(3),
    improvements: z.array(z.string().min(1).max(180)).min(1).max(3),
  }),
  con: z.object({
    totalScore: z.number().int().min(0).max(100),
    clarity: z.number().int().min(0).max(100),
    argumentStrength: z.number().int().min(0).max(100),
    structure: z.number().int().min(0).max(100),
    delivery: z.number().int().min(0).max(100),
    strengths: z.array(z.string().min(1).max(180)).min(1).max(3),
    improvements: z.array(z.string().min(1).max(180)).min(1).max(3),
  }),
});

export type DebateVerdict = z.infer<typeof verdictSchema>;

export function cleanModelJson(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return trimmed;
}

export function buildJudgePrompt(topic: string, proTranscript: string, conTranscript: string) {
  return `You are DebateRush's strict but encouraging debate adjudicator. Judge the two arguments fairly based only on the supplied transcripts. Do not reward factual claims you cannot verify. Give each side independent integer scores out of 100 for clarity, argumentStrength, structure, and delivery, then an integer totalScore from 0 to 100. Select winner as pro, con, or draw. Give compact, concrete feedback.\n\nTopic: ${topic}\n\nPRO transcript:\n${proTranscript || "[No intelligible transcript was captured]"}\n\nCON transcript:\n${conTranscript || "[No intelligible transcript was captured]"}\n\nReturn JSON only, exactly matching the requested response schema.`;
}

const verdictJsonSchema = {
  name: "debate_verdict",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      winner: { type: "string", enum: ["pro", "con", "draw"] },
      overallSummary: { type: "string" },
      pro: {
        type: "object",
        additionalProperties: false,
        properties: {
          totalScore: { type: "integer", minimum: 0, maximum: 100 },
          clarity: { type: "integer", minimum: 0, maximum: 100 },
          argumentStrength: { type: "integer", minimum: 0, maximum: 100 },
          structure: { type: "integer", minimum: 0, maximum: 100 },
          delivery: { type: "integer", minimum: 0, maximum: 100 },
          strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          improvements: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
        },
        required: ["totalScore", "clarity", "argumentStrength", "structure", "delivery", "strengths", "improvements"],
      },
      con: {
        type: "object",
        additionalProperties: false,
        properties: {
          totalScore: { type: "integer", minimum: 0, maximum: 100 },
          clarity: { type: "integer", minimum: 0, maximum: 100 },
          argumentStrength: { type: "integer", minimum: 0, maximum: 100 },
          structure: { type: "integer", minimum: 0, maximum: 100 },
          delivery: { type: "integer", minimum: 0, maximum: 100 },
          strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
          improvements: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
        },
        required: ["totalScore", "clarity", "argumentStrength", "structure", "delivery", "strengths", "improvements"],
      },
    },
    required: ["winner", "overallSummary", "pro", "con"],
  },
};

export async function judgeDebate(input: {
  apiKey: string;
  topic: string;
  proTranscript: string;
  conTranscript: string;
  model: string;
}) {
  const request = (structured: boolean) => fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "X-OpenRouter-Title": "DebateRush",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.3,
      messages: [
        { role: "system", content: "You are a precise, unbiased debate judge. Return only the requested valid JSON." },
        { role: "user", content: buildJudgePrompt(input.topic, input.proTranscript, input.conTranscript) },
      ],
      ...(structured ? {
        response_format: { type: "json_schema", json_schema: verdictJsonSchema },
        provider: { require_parameters: true },
      } : {}),
    }),
  });

  let response = await request(true);
  if (!response.ok) response = await request(false);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenRouter evaluation failed (${response.status}): ${detail.slice(0, 240)}`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no verdict content.");
  return verdictSchema.parse(JSON.parse(cleanModelJson(content)));
}
