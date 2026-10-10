"use client";

import { useEffect, useState } from "react";
import StepBar from "./StepBar";
import type { PromiseEntry } from "@/lib/store";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// One step on screen at a time. Tap done, next one shows up.
export default function Work({
  promise,
  onStep,
}: {
  promise: PromiseEntry;
  onStep: (stepsDone: number) => void;
}) {
  const steps = promise.steps;
  const done = promise.steps_done;
  const step = steps[done];
  const total = promise.minutes * 60;
  const startedAt = Date.parse(promise.started_at!);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const left = Math.max(0, total - Math.floor((now - startedAt) / 1000));

  return (
    <section className="glow rise p-5">
      <div className="flex items-center justify-between">
        <span className="label">
          Step {Math.min(done + 1, steps.length)} / {steps.length}
        </span>
        <span className={`font-display text-[22px] leading-none tabular-nums tracking-wide ${left ? "text-muted" : "text-missed"}`}>
          {fmt(left)}
        </span>
      </div>
      <div className="mt-3">
        <StepBar total={steps.length} done={done} />
      </div>

      {step && (
        <div key={done} className="rise py-9">
          <p className="glow-text text-[26px] font-semibold leading-tight">{step.text}</p>
          <p className="mt-2 text-[14px] text-muted">~{step.minutes} min</p>
        </div>
      )}

      <button onClick={() => onStep(done + 1)} className="btn btn-primary h-14 w-full text-[13px]">
        ✓ Done
      </button>
      {steps[done + 1] && (
        <p className="mt-3 truncate text-center text-[13px] text-faint">Next: {steps[done + 1].text}</p>
      )}
    </section>
  );
}
