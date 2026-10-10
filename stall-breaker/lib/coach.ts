import { daysAgo, type PromiseEntry, type Step } from "./store";

// No AI: the app's rules do the coaching. The user does the thinking; the rules keep it small.

const CALLOUTS: [RegExp, string][] = [
  [
    /\b(research|look into|learn|study|tutorials?|figure (it |this )?out|more info)\b/i,
    "More research is just a safer way to not start. You know enough to do step 1.",
  ],
  [
    /\b(camera|mic|microphone|gear|equipment|laptop|setup|lighting|software|tool|app)\b/i,
    "The gear isn't the problem. Use what you've got. Ugly first.",
  ],
  [
    /\b(right time|not ready|someday|next week|later|when i'?m ready|after i|once i)\b/i,
    "There's no right time coming. There's tonight.",
  ],
  [/\b(perfect|perfectly|polish|good enough|nail it)\b/i, "You're waiting for it to be good. Make it bad first, then fix it."],
  [/\b(plan|planning|strategy|roadmap|organi[sz]e)\b/i, "Another plan isn't progress. Do the first piece of it."],
];

export const calloutFor = (text: string) => CALLOUTS.find(([re]) => re.test(text))?.[1] ?? null;

const THINKING = /\b(figure out|think( about)?|brainstorm|decide|research|plan|learn|look into|consider|explore|reflect|tutorials?)\b/i;
export const isThinkingStep = (text: string) => THINKING.test(text);

export const STEP_MINUTES = [2, 5, 8];

// Missed yesterday → smaller day.
export const limitsFor = (missed: boolean) =>
  missed ? { maxSteps: 3, maxMinutes: 15 } : { maxSteps: 5, maxMinutes: 30 };

export function checkSteps(steps: Step[], finishLine: string, missed: boolean): string | null {
  const { maxSteps, maxMinutes } = limitsFor(missed);
  if (steps.length < 2) return "Write at least 2 steps.";
  if (steps.length > maxSteps) return `Max ${maxSteps} steps${missed ? " today" : ""}. Cut one.`;
  const thinking = steps.findIndex((s) => isThinkingStep(s.text));
  if (thinking >= 0) return `Step ${thinking + 1} is a thinking step. What do you physically do?`;
  const total = steps.reduce((n, s) => n + s.minutes, 0);
  if (total > maxMinutes) return `${total} min is over the ${maxMinutes} min cap. Cut it down.`;
  if (!finishLine.trim()) return "Say what “done” looks like.";
  return null;
}

// Too big? Keep the first half and finish that.
export const halve = (steps: Step[]) => steps.slice(0, Math.max(2, Math.ceil(steps.length / 2)));

const STEWARDSHIP = [
  "What were you given this week that you didn't use?",
  "Where did the time you were given actually go?",
  "What's one thing you were trusted with that deserves your first 20 minutes next week?",
  "Faithful in little first. What's the little thing to be faithful in next week?",
];

export function weeklyReview(rows: PromiseEntry[]) {
  const week = rows.filter((r) => r.date >= daysAgo(6));
  const kept = week.filter((r) => r.status === "kept");
  const missed = week.filter((r) => r.status === "missed").length;
  const proof = kept[0] ? ` Latest proof: “${kept[0].task}”.` : "";
  const q = STEWARDSHIP[Math.floor(Date.now() / (7 * 86_400_000)) % STEWARDSHIP.length];
  return `${kept.length} kept, ${missed} missed this week.${proof} ${q}`;
}
