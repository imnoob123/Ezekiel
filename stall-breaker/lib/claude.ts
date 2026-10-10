import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { DIAGNOSE_PROMPT, RESEARCH_PROMPT, REVIEW_PROMPT, SHRINK_PROMPT } from "./prompts";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

// Server-side refusal fallback: if the model declines, the API retries on a fallback model.
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

export const TaskSchema = z.object({
  stall_type: z.enum(["research", "gear", "timing", "planning", "perfection", "skill", "none"]),
  callout: z.string().nullable(),
  research_query: z.string().nullable(),
  task: z.string(),
  finish_line: z.string(),
  proof_hint: z.string(),
  minutes: z.number().int(),
});
export type AiTask = z.infer<typeof TaskSchema>;

export const hasClaude = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

async function structuredTask(system: string, user: string): Promise<AiTask> {
  const res = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(TaskSchema) },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    throw new Error("The AI couldn't answer that one. Try rewording it.");
  }
  const t = res.parsed_output;
  return { ...t, minutes: Math.max(5, Math.min(30, t.minutes)) };
}

export async function diagnose(input: {
  building: string;
  missedYesterday: boolean;
  recent: { promise: string; status: string }[];
}): Promise<AiTask> {
  const recent = input.recent.length
    ? input.recent.map((r) => `- ${r.promise} (${r.status})`).join("\n")
    : "none yet";
  return structuredTask(
    DIAGNOSE_PROMPT,
    `What they're building today: "${input.building}"\nmissed_yesterday: ${input.missedYesterday}\nRecent ledger:\n${recent}`,
  );
}

export async function shrink(input: { building: string; task: string; minutes: number }) {
  return structuredTask(
    SHRINK_PROMPT,
    `Goal: "${input.building}"\nCurrent task (${input.minutes} min): "${input.task}"\nThey said: too big.`,
  );
}

export async function research(query: string, building: string): Promise<string[]> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Their goal: "${building}"\nQuestion to answer: ${query}` },
  ];
  // Server-side search can pause long turns; resume a couple of times at most.
  for (let i = 0; i < 3; i++) {
    const res = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 6000,
      ...FALLBACK,
      output_config: { effort: "low" },
      system: RESEARCH_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages,
    });
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- "))
      .map((l) => l.slice(2))
      .slice(0, 5);
  }
  return [];
}

export async function weeklyReview(entries: { date: string; promise: string; status: string; proof: string | null }[]) {
  const log = entries
    .map((e) => `${e.date}: ${e.promise} — ${e.status}${e.proof ? ` (proof: ${e.proof})` : ""}`)
    .join("\n");
  const res = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    ...FALLBACK,
    output_config: { effort: "low" },
    system: REVIEW_PROMPT,
    messages: [{ role: "user", content: log || "No entries this week." }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}
