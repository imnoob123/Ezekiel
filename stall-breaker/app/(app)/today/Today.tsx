"use client";

import { useEffect, useState } from "react";
import ProgressCard from "@/components/ProgressCard";
import ProofForm, { type Proof } from "@/components/ProofForm";
import StepEditor from "@/components/StepEditor";
import Work from "@/components/Work";
import { calloutFor, weeklyReview } from "@/lib/coach";
import { loadLedger } from "@/lib/ledger";
import { keptLast30, missedYesterday } from "@/lib/score";
import {
  createPromise,
  daysAgo,
  today,
  updatePromise,
  uploadProof,
  type PromiseEntry,
  type Step as MicroStep,
} from "@/lib/store";

type Stage = "loading" | "input" | "steps" | "work" | "proof" | "kept";

const REVIEW_KEY = "stallbreaker.lastReview";

// Once a week: a short stewardship review of the last 7 days.
function reviewIfDue(list: PromiseEntry[]): string | null {
  let last: string | null = null;
  try {
    last = localStorage.getItem(REVIEW_KEY);
  } catch {}
  const weekOld = list.some((r) => r.date <= daysAgo(6));
  if (!weekOld || (last && last > daysAgo(7))) return null;
  return weeklyReview(list);
}

export default function Today() {
  const [rows, setRows] = useState<PromiseEntry[]>([]);
  const [stage, setStage] = useState<Stage>("loading");
  const [building, setBuilding] = useState("");
  const [callout, setCallout] = useState<string | null>(null);
  const [active, setActive] = useState<PromiseEntry | null>(null);
  const [missed, setMissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    let alive = true;
    loadLedger()
      .then(({ list, open }) => {
        if (!alive) return;
        setRows(list);
        setDateLabel(new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
        setMissed(missedYesterday(list));
        setActive(open);
        setStage(open ? (open.steps_done >= open.steps.length ? "proof" : "work") : "input");
        setReview(reviewIfDue(list));
        // Coming from Setback Mode with a next move: pre-fill it.
        const fromSetback = new URLSearchParams(location.search).get("b");
        if (!open && fromSetback) setBuilding(fromSetback);
      })
      .catch(() => alive && setError("Couldn't load your ledger."));
    return () => {
      alive = false;
    };
  }, []);

  function dismissReview() {
    try {
      localStorage.setItem(REVIEW_KEY, today());
    } catch {}
    setReview(null);
  }

  const save = (p: PromiseEntry) => {
    setActive(p);
    setRows((r) => [p, ...r.filter((x) => x.id !== p.id)]);
  };

  function next() {
    if (!building.trim()) return;
    setCallout(calloutFor(building));
    setStage("steps");
  }

  // Starting is the promise. That's when it hits the ledger.
  async function start(steps: MicroStep[], finishLine: string) {
    setBusy(true);
    setError(null);
    try {
      const row = await createPromise({
        date: today(),
        building: building.trim(),
        task: building.trim(),
        steps,
        finish_line: finishLine,
        proof_hint: null,
        callout,
        minutes: steps.reduce((n, s) => n + s.minutes, 0),
      });
      save(await updatePromise(row.id, { started_at: new Date().toISOString() }));
      setStage("work");
    } catch {
      setError("Couldn't save that. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  function stepDone(stepsDone: number) {
    if (!active) return;
    save({ ...active, steps_done: stepsDone });
    setStage(stepsDone >= active.steps.length ? "proof" : "work");
    updatePromise(active.id, { steps_done: stepsDone }).catch(() => setError("Couldn't save that step."));
  }

  async function submitProof(proof: Proof) {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const path = proof.file ? await uploadProof(proof.file) : null;
      save(
        await updatePromise(active.id, {
          status: "kept",
          proof_type: proof.type,
          proof_text: proof.text ?? proof.file?.name ?? null,
          proof_path: path,
          completed_at: new Date().toISOString(),
        }),
      );
      setStage("kept");
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function another() {
    setActive(null);
    setBuilding("");
    setCallout(null);
    setMissed(false);
    setStage("input");
  }

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between pb-1">
        <h1 className="font-display text-[56px] leading-[0.8] tracking-wide">TODAY</h1>
        <span className="label pb-0.5">{dateLabel}</span>
      </header>

      {stage === "loading" ? (
        <>
          <div className="card breathe h-[150px]" />
          <div className="card breathe h-56" />
        </>
      ) : (
        <ProgressCard rows={rows} />
      )}

      {review && (
        <section className="card rise p-5">
          <div className="flex items-center justify-between">
            <p className="label">Weekly review · Stewardship</p>
            <button onClick={dismissReview} className="label hover:text-text">Got it</button>
          </div>
          <p className="mt-3 leading-relaxed text-text/90">{review}</p>
        </section>
      )}

      {stage === "input" && (
        <section className="glow rise p-5">
          {missed && <p className="mb-4 font-medium">Missed yesterday. Today&apos;s task is smaller.</p>}
          <label htmlFor="building" className="label">What are you building today?</label>
          <textarea
            id="building"
            rows={3}
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) next();
            }}
            placeholder="Plain words. What are you trying to get done?"
            className="field mt-3 resize-none leading-relaxed"
          />
          <button onClick={next} disabled={!building.trim()} className="btn btn-primary mt-4 w-full">
            Break it down
          </button>
        </section>
      )}

      {stage === "steps" && (
        <section className="glow rise p-5">
          {missed && <p className="mb-3 font-medium">Missed yesterday. Today&apos;s task is smaller.</p>}
          {callout && <p className="mb-4 text-[15px] leading-snug text-text/80">{callout}</p>}
          <p className="glow-text mb-5 text-[20px] font-semibold leading-tight">{building}</p>
          <StepEditor missed={missed} busy={busy} onStart={start} />
          <button onClick={() => setStage("input")} className="label mt-4 block w-full text-center hover:text-text">
            Back
          </button>
        </section>
      )}

      {stage === "work" && active && <Work promise={active} onStep={stepDone} />}

      {stage === "proof" && active && (
        <section className="glow rise p-5">
          <p className="label">Last thing · proof</p>
          <p className="mt-1.5 text-[20px] font-semibold leading-tight">Show what you made</p>
          <p className="mt-1 text-[14px] text-muted">Done when {active.finish_line}</p>
          <ProofForm busy={busy} onSubmit={submitProof} onBack={() => stepDone(active.steps.length - 1)} />
        </section>
      )}

      {stage === "kept" && active && (
        <section className="glow rise p-6 text-center">
          <p className="label">Kept</p>
          <p className="glow-text mt-3 font-display text-[96px] leading-[0.8] tracking-wide text-accent-hi">+1</p>
          <p className="mt-4 text-muted">{keptLast30(rows)} kept in 30 days. That&apos;s evidence, not a feeling.</p>
          <button onClick={another} className="btn btn-ghost mt-6 w-full">Go again</button>
        </section>
      )}

      {error && <p className="text-center text-[14px] text-missed">{error}</p>}
    </div>
  );
}
