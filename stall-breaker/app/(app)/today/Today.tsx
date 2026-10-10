"use client";

import { useEffect, useState } from "react";
import ProgressCard from "@/components/ProgressCard";
import Work from "@/components/Work";
import ProofForm, { type Proof } from "@/components/ProofForm";
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

type Draft = {
  building: string;
  callout: string | null;
  task: string;
  steps: MicroStep[];
  finish_line: string;
  proof_hint: string;
  minutes: number;
};

type Stage = "loading" | "input" | "thinking" | "plan" | "work" | "proof" | "kept";

const REVIEW_KEY = "stallbreaker.lastReview";

async function coach(body: object) {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Something broke.");
  return json;
}

// Once a week: a short stewardship review of the last 7 days.
async function fetchReview(list: PromiseEntry[]): Promise<string | null> {
  let last: string | null = null;
  try {
    last = localStorage.getItem(REVIEW_KEY);
  } catch {}
  const weekOld = list.some((r) => r.date <= daysAgo(6));
  if (!weekOld || (last && last > daysAgo(7))) return null;
  const week = list
    .filter((r) => r.date >= daysAgo(6))
    .map((r) => ({ date: r.date, promise: r.task, status: r.status, proof: r.proof_text ?? r.proof_type }));
  try {
    const { text } = await coach({ mode: "review", entries: week });
    return text;
  } catch {
    return null;
  }
}

export default function Today() {
  const [rows, setRows] = useState<PromiseEntry[]>([]);
  const [stage, setStage] = useState<Stage>("loading");
  const [building, setBuilding] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [active, setActive] = useState<PromiseEntry | null>(null);
  const [missed, setMissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [dateLabel, setDateLabel] = useState("");

  const stageFor = (p: PromiseEntry): Stage =>
    !p.started_at ? "plan" : p.steps_done >= p.steps.length ? "proof" : "work";

  useEffect(() => {
    let alive = true;
    loadLedger()
      .then(({ list, open }) => {
        if (!alive) return;
        setRows(list);
        setDateLabel(new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }));
        setMissed(missedYesterday(list));
        setActive(open);
        setStage(open ? stageFor(open) : "input");
        // Coming from Setback Mode with a next move: pre-fill it.
        const fromSetback = new URLSearchParams(location.search).get("b");
        if (!open && fromSetback) setBuilding(fromSetback);
        return fetchReview(list);
      })
      .then((text) => alive && text && setReview(text))
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

  async function breakStall() {
    if (!building.trim()) return;
    setError(null);
    setStage("thinking");
    try {
      const recent = rows.slice(0, 5).map((r) => ({ promise: r.task, status: r.status }));
      const ai = await coach({ mode: "diagnose", building, missedYesterday: missed, recent });
      setDraft({ building, ...ai });
      setStage("plan");
    } catch (e) {
      setError((e as Error).message);
      setStage("input");
    }
  }

  async function tooBig() {
    const cur = active ?? draft;
    if (!cur) return;
    setBusy(true);
    setError(null);
    try {
      const ai = await coach({
        mode: "shrink",
        building: cur.building,
        task: cur.task,
        minutes: cur.minutes,
        steps: cur.steps.map((s) => s.text),
      });
      const next = {
        task: ai.task,
        steps: ai.steps,
        finish_line: ai.finish_line,
        proof_hint: ai.proof_hint,
        minutes: ai.minutes,
        callout: ai.callout,
      };
      if (active) save(await updatePromise(active.id, next));
      else setDraft({ ...cur, ...next });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Starting is the promise. That's when it hits the ledger.
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const started_at = new Date().toISOString();
      const p = active
        ? await updatePromise(active.id, { started_at })
        : await createPromise({
            date: today(),
            building: draft!.building,
            task: draft!.task,
            steps: draft!.steps,
            finish_line: draft!.finish_line,
            proof_hint: draft!.proof_hint,
            callout: draft!.callout,
            minutes: draft!.minutes,
          }).then((row) => updatePromise(row.id, { started_at }));
      save(p);
      setStage("work");
    } catch {
      setError("Couldn't save that. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function stepDone(stepsDone: number) {
    if (!active) return;
    const optimistic = { ...active, steps_done: stepsDone };
    save(optimistic);
    if (stepsDone >= active.steps.length) setStage("proof");
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
    setDraft(null);
    setBuilding("");
    setMissed(false);
    setStage("input");
  }

  const plan = active ?? draft;

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
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) breakStall();
            }}
            placeholder="Plain words. What are you trying to get done?"
            className="field mt-3 resize-none leading-relaxed"
          />
          <button onClick={breakStall} disabled={!building.trim()} className="btn btn-primary mt-4 w-full">
            Break it down
          </button>
        </section>
      )}

      {stage === "thinking" && (
        <section className="glow rise flex flex-col items-center p-8">
          <div className="flex h-10 items-end gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="breathe w-2.5 rounded-sm bg-accent"
                style={{ height: `${30 + i * 17}%`, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="label mt-4">Breaking it down</p>
        </section>
      )}

      {stage === "plan" && plan && (
        <section className="glow rise p-5">
          {missed && !active && <p className="mb-3 font-medium">Missed yesterday. Today&apos;s task is smaller.</p>}
          {plan.callout && <p className="text-[15px] leading-snug text-text/80">{plan.callout}</p>}

          <p className={`label ${plan.callout ? "mt-5" : ""}`}>Tonight · {plan.minutes} min</p>
          <p className="glow-text mt-1.5 text-[24px] font-semibold leading-tight">{plan.task}</p>

          <ol className="mt-5 space-y-2.5">
            {plan.steps.map((s, i) => (
              <li key={i} className="flex items-baseline gap-3 text-[15px]">
                <span className="w-4 shrink-0 font-display text-[17px] text-accent-hi">{i + 1}</span>
                <span className="flex-1 leading-snug">{s.text}</span>
                <span className="shrink-0 text-[12px] tabular-nums text-faint">{s.minutes}m</span>
              </li>
            ))}
          </ol>

          <div className="mt-6 grid grid-cols-[1fr_auto] gap-2">
            <button onClick={start} disabled={busy} className="btn btn-primary">Start step 1</button>
            <button onClick={tooBig} disabled={busy} className="btn btn-ghost">{busy ? "…" : "Too big"}</button>
          </div>
        </section>
      )}

      {stage === "work" && active && <Work promise={active} onStep={stepDone} />}

      {stage === "proof" && active && (
        <section className="glow rise p-5">
          <p className="label">Last thing · proof</p>
          <p className="mt-1.5 text-[20px] font-semibold leading-tight">{active.proof_hint || "Show what you made"}</p>
          <p className="mt-1 text-[14px] text-muted">{active.finish_line}</p>
          <ProofForm busy={busy} onSubmit={submitProof} onBack={() => stepDone(active.steps.length - 1).then(() => setStage("work"))} />
        </section>
      )}

      {stage === "kept" && active && (
        <section className="glow rise p-6 text-center">
          <p className="label">Kept</p>
          <p className="glow-text mt-3 font-display text-[96px] leading-[0.8] tracking-wide text-accent-hi">+1</p>
          <p className="mt-4 text-muted">
            {keptLast30(rows)} kept in 30 days. That&apos;s evidence, not a feeling.
          </p>
          <button onClick={another} className="btn btn-ghost mt-6 w-full">Go again</button>
        </section>
      )}

      {error && <p className="text-center text-[14px] text-missed">{error}</p>}
    </div>
  );
}
