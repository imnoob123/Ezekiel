import type { AiTask } from "./claude";

// Canned replies used when ANTHROPIC_API_KEY isn't set, so the UI can be clicked through locally.
export function mockDiagnose(_building: string, missedYesterday: boolean): AiTask {
  const steps = missedYesterday
    ? [
        { text: "Open a blank doc titled 'Video 1 script'", minutes: 1 },
        { text: "Write the hook: one sentence, no editing", minutes: 4 },
        { text: "Write the next 3 lines under it", minutes: 6 },
      ]
    : [
        { text: "Open a blank doc titled 'Video 1 script'", minutes: 1 },
        { text: "Write the hook: one sentence, no editing", minutes: 4 },
        { text: "Write 3 bullet points you'll talk through", minutes: 6 },
        { text: "Turn each bullet into 2 spoken sentences", minutes: 10 },
        { text: "Write a one-line ending and stop", minutes: 3 },
      ];
  return {
    stall_type: "gear",
    callout: "The camera isn't the problem. Your phone films fine. You're scared it'll be bad, so start with the script.",
    task: missedYesterday ? "Write the hook and first 3 lines" : "Write the full 45-second script",
    steps,
    finish_line: "Done when the script exists start to finish, ugly or not.",
    proof_hint: "Paste the script",
    minutes: steps.reduce((n, s) => n + s.minutes, 0),
  };
}

export function mockShrink(): AiTask {
  const steps = [
    { text: "Open a blank doc titled 'Hook'", minutes: 1 },
    { text: "Write one hook sentence", minutes: 4 },
  ];
  return {
    stall_type: "none",
    callout: "Fine. Smaller.",
    task: "Write just the hook",
    steps,
    finish_line: "Done when one sentence exists.",
    proof_hint: "Paste the sentence",
    minutes: 5,
  };
}

export const mockReview =
  "You kept 4 of 6 this week, and the proof is real: two scripts and a live landing page. Thursday and Saturday slipped. Next week, steward the first 20 minutes after you sit down; that's where the nights get lost.";

export const mockListen = "Losing the client right after you finally landed one stings.\nWhat can you get from this?";
export const mockMove = {
  leverage: "You now know exactly why that offer didn't stick: no clear deliverable in week one.",
  next_move: "Write a one-page week-one deliverable list for your next client.",
};
