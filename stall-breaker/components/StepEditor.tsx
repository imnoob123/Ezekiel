"use client";

import { useEffect, useState } from "react";
import { STEP_MINUTES, checkSteps, halve, isThinkingStep, limitsFor } from "@/lib/coach";
import type { Step } from "@/lib/store";

const PLACEHOLDERS = [
  "Open a blank doc and title it",
  "Write the first ugly line",
  "Add the next piece",
  "Fill in the rest, no editing",
  "Save it and copy the link",
];

export default function StepEditor({
  missed,
  busy,
  onStart,
  building,
}: {
  building: string;
  missed: boolean;
  busy: boolean;
  onStart: (steps: Step[], finishLine: string) => void;
}) {
  const { maxSteps, maxMinutes } = limitsFor(missed);
  const [steps, setSteps] = useState<Step[]>([
    { text: "", minutes: 2 },
    { text: "", minutes: 5 },
    { text: "", minutes: 5 },
  ].slice(0, missed ? 2 : 3));
  const [finish, setFinish] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const [aiOn, setAiOn] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    fetch("/api/coach").then((r) => r.json()).then((d) => setAiOn(Boolean(d.enabled))).catch(() => {});
  }, []);

  // Optional: AI drafts the steps, you still edit them and the same rules apply.
  async function suggest() {
    setAiBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ building, missed }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSteps(d.steps);
      setFinish(d.finish);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI hiccup.");
    } finally {
      setAiBusy(false);
    }
  }

  const filled = steps.filter((s) => s.text.trim()).map((s) => ({ ...s, text: s.text.trim() }));
  const total = filled.reduce((n, s) => n + s.minutes, 0);

  const set = (i: number, patch: Partial<Step>) => setSteps((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const cycle = (m: number) => STEP_MINUTES[(STEP_MINUTES.indexOf(m) + 1) % STEP_MINUTES.length];

  function start() {
    const problem = checkSteps(filled, finish, missed);
    setErr(problem);
    if (!problem) onStart(filled, finish.trim());
  }

  function tooBig() {
    setSteps(halve(filled.length >= 2 ? filled : steps));
    setErr("Cut in half. Finish these first.");
  }

  return (
    <div>
      <p className="label">Break it down</p>
      <p className="mt-1 text-[14px] text-muted">So small it feels almost too easy. Actions, not thinking.</p>

      {aiOn && (
        <button type="button" onClick={suggest} disabled={aiBusy} className="label mt-3 block hover:text-text">
          {aiBusy ? "Thinking…" : "Suggest steps with AI"}
        </button>
      )}

      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => {
          const thinking = s.text.trim() && isThinkingStep(s.text);
          return (
            <li key={i} className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-center font-display text-[17px] text-accent-hi">{i + 1}</span>
              <input
                value={s.text}
                onChange={(e) => set(i, { text: e.target.value })}
                placeholder={i === 0 ? "Under 2 min: open, title, set up" : PLACEHOLDERS[i]}
                className={`field h-11 flex-1 px-3 py-0 text-[15px] ${thinking ? "border-missed/70" : ""}`}
              />
              {i === 0 ? (
                <span className="pill pill-muted w-12 justify-center">2m</span>
              ) : (
                <button
                  type="button"
                  onClick={() => set(i, { minutes: cycle(s.minutes) })}
                  className="pill pill-muted w-12 justify-center hover:text-text"
                  title="Tap to change minutes"
                >
                  {s.minutes}m
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {steps.length < maxSteps && (
        <button
          type="button"
          onClick={() => setSteps((all) => [...all, { text: "", minutes: 5 }])}
          className="label mt-3 pl-6 hover:text-text"
        >
          + Add step
        </button>
      )}

      <label className="label mt-5 block" htmlFor="finish">Done when…</label>
      <input
        id="finish"
        value={finish}
        onChange={(e) => setFinish(e.target.value)}
        placeholder="the script exists in a doc"
        className="field mt-2 h-11 px-3 py-0 text-[15px]"
      />

      <div className="mt-4 flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.14em]">
        <span className={total > maxMinutes ? "text-missed" : "text-faint"}>
          {total} / {maxMinutes} min
        </span>
        <button type="button" onClick={tooBig} className="text-faint hover:text-text">Too big?</button>
      </div>

      {err && <p className="mt-3 text-[14px] text-missed">{err}</p>}

      <button onClick={start} disabled={busy} className="btn btn-primary mt-4 w-full">
        Start step 1
      </button>
    </div>
  );
}
