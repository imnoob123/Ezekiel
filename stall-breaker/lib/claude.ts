import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  DIAGNOSE_PROMPT,
  REVIEW_PROMPT,
  SETBACK_LISTEN_PROMPT,
  SETBACK_MOVE_PROMPT,
  SHRINK_PROMPT,
} from "./prompts";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

// Server-side refusal fallback: if the model declines, the API retries on a fallback model.
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

export const TaskSchema = z.object({
  stall_type: z.enum(["research", "gear", "timing", "planning", "perfection", "skill", "none"]),
  callout: z.string().nullable(),
  task: z.string(),
  steps: z.array(z.object({ text: z.string(), minutes: z.number().int() })),
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
  const steps = t.steps.slice(0, 5).map((st) => ({ ...st, minutes: Math.max(1, Math.min(10, st.minutes)) }));
  const minutes = steps.reduce((n, st) => n + st.minutes, 0) || t.minutes;
  return { ...t, steps, minutes: Math.max(5, Math.min(30, minutes)) };
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

export async function shrink(input: { building: string; task: string; minutes: number; steps: string[] }) {
  return structuredTask(
    SHRINK_PROMPT,
    `Goal: "${input.building}"\nCurrent task (${input.minutes} min): "${input.task}"\nCurrent steps:\n${input.steps.map((s) => `- ${s}`).join("\n")}\nThey said: too big.`,
  );
}

export async function weeklyReview(entries: { date: string; promise: string; status: string; proof: string | null }[]) {
  const log = entries
    .map((e) => `${e.date}: ${e.promise} — ${e.status}${e.proof ? ` (proof: ${e.proof})` : ""}`)
    .join("\n");
  return text(REVIEW_PROMPT, log || "No entries this week.");
}

async function text(system: string, user: string) {
  const res = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    ...FALLBACK,
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

export const setbackListen = (rant: string) => text(SETBACK_LISTEN_PROMPT, `What happened:\n${rant}`);

const MoveSchema = z.object({ leverage: z.string(), next_move: z.string() });
export type SetbackMove = z.infer<typeof MoveSchema>;

export async function setbackMove(rant: string, answer: string): Promise<SetbackMove> {
  const res = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(MoveSchema) },
    system: SETBACK_MOVE_PROMPT,
    messages: [{ role: "user", content: `What happened:\n${rant}\n\nWhat they can get from it:\n${answer}` }],
  });
  if (!res.parsed_output) throw new Error("The AI couldn't answer that one.");
  return res.parsed_output;
}
