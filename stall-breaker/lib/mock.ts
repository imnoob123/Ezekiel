import type { AiTask } from "./claude";

// Canned replies used when ANTHROPIC_API_KEY isn't set, so the UI can be clicked through locally.
export function mockDiagnose(building: string, missedYesterday: boolean): AiTask {
  const research = /research|figure out|which|best|compare/i.test(building);
  return {
    stall_type: research ? "research" : "perfection",
    callout: research
      ? "You don't need more research. You need a decision, and research is how you're dodging it."
      : "You're waiting for it to feel ready. It won't. Ship the ugly version.",
    research_query: research ? "Which option should they pick?" : null,
    task: missedYesterday
      ? "Write the hook and first 3 lines of the script. Nothing else."
      : "Write the full 45-second script in a doc. One take, no editing.",
    finish_line: missedYesterday
      ? "Done when the hook and 3 lines exist in a doc."
      : "Done when the script exists start to finish, ugly or not.",
    proof_hint: "Paste the text or drop the doc link.",
    minutes: missedYesterday ? 15 : 25,
  };
}

export function mockShrink(minutes: number): AiTask {
  return {
    stall_type: "none",
    callout: "Fine. Smaller.",
    research_query: null,
    task: "Write just the hook. One sentence.",
    finish_line: "Done when one sentence exists.",
    proof_hint: "Paste the sentence.",
    minutes: Math.max(5, Math.floor(minutes / 2)),
  };
}

export const mockResearch = [
  "Pick the one you can start tonight with what you already own.",
  "Most people in your spot ship faster with the free tier first; upgrade after 10 posts.",
  "Decide in 2 minutes, then don't revisit it for 30 days.",
];

export const mockReview =
  "You kept 4 of 6 this week, and the proof is real: two scripts and a live landing page. Thursday and Saturday slipped. Next week, steward the first 20 minutes after you sit down; that's where the nights get lost.";
