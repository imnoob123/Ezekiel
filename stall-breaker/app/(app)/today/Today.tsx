"use client";

import { useEffect, useState } from "react";
import ScoreCard from "@/components/ScoreCard";
import Timer from "@/components/Timer";
import ProofForm, { type Proof } from "@/components/ProofForm";
import { keptLast30, missedYesterday, staleOpen } from "@/lib/score";
import {
  createPromise,
  daysAgo,
  listPromises,
  today,
  updatePromise,
  uploadProof,
  type PromiseEntry,
} from "@/lib/store";

type Draft = {
  building: string;
  callout: string | null;
  research: string[] | null;
  task: string;
  finish_line: string;
  proof_hint: string;
  minutes: number;
};

type Step = "loading" | "input" | "thinking" | "task" | "timer" | "proof" | "kept";

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

async function loadLedger() {
  let list = await listPromises();
  // Anything left open on an earlier day never got proof: it's missed. No drama.
  const stale = staleOpen(list);
  if (stale.length) {
    await Promise.all(stale.map((r) => updatePromise(r.id, { status: "missed" })));
    list = await listPromises();
  }
  const open = list.find((r) => r.status === "open" && r.date === today()) ?? null;
  return { list, open };
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
  const [step, setStep] = useState<Step>("loading");
  const [building, setBuilding] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
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
        setStep(open ? (open.started_at ? "timer" : "task") : "input");
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

  async function breakStall() {
    if (!building.trim()) return;
    setError(null);
    setStep("thinking");
    try {
      const recent = rows.slice(0, 5).map((r) => ({ promise: r.task, status: r.status }));
      const ai = await coach({ mode: "diagnose", building, missedYesterday: missed, recent });
      setDraft({ building, ...ai });
      setStep("task");
    } catch (e) {
      setError((e as Error).message);
      setStep("input");
    }
  }

  async function tooBig() {
    const cur = active ?? draft;
    if (!cur) return;
    setBusy(true);
    setError(null);
    try {
      const ai = await coach({ mode: "shrink", building: cur.building, task: cur.task, minutes: cur.minutes });
      const next = {
        task: ai.task,
        finish_line: ai.finish_line,
        proof_hint: ai.proof_hint,
        minutes: ai.minutes,
        callout: ai.callout,
        research: cur.research,
      };
      if (active) setActive(await updatePromise(active.id, next));
      else setDraft({ ...draft!, ...next });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Starting the timer is the promise. That's when it hits the ledger.
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const startedAt = new Date().toISOString();
      const p = active
        ? await updatePromise(active.id, { started_at: startedAt })
        : await createPromise({
            date: today(),
            building: draft!.building,
            task: draft!.task,
            finish_line: draft!.finish_line,
            proof_hint: draft!.proof_hint,
            callout: draft!.callout,
            research: draft!.research,
            minutes: draft!.minutes,
          }).then((row) => updatePromise(row.id, { started_at: startedAt }));
      setActive(p);
      setRows((r) => [p, ...r.filter((x) => x.id !== p.id)]);
      setStep("timer");
    } catch {
      setError("Couldn't save that. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function submitProof(proof: Proof) {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const path = proof.file ? await uploadProof(proof.file) : null;
      const p = await updatePromise(active.id, {
        status: "kept",
        proof_type: proof.type,
        proof_text: proof.text ?? proof.file?.name ?? null,
        proof_path: path,
        completed_at: new Date().toISOString(),
      });
      setActive(p);
      setRows((r) => r.map((x) => (x.id === p.id ? p : x)));
      setStep("kept");
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
    setStep("input");
  }

  const shown = active ?? draft;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <h1 className="font-display text-[68px] leading-[0.8] tracking-wide">TODAY</h1>
        <span className="label pb-1">{dateLabel}</span>
      </header>

      {step !== "loading" && <ScoreCard rows={rows} />}

      {review && (
        <section className="card rise p-5">
          <div className="flex items-center justify-between">
            <p className="label">Weekly review · Stewardship</p>
            <button onClick={dismissReview} className="label hover:text-text">Got it</button>
          </div>
          <p className="mt-3 leading-relaxed text-text/90">{review}</p>
        </section>
      )}

      {step === "loading" && (
        <>
          <div className="card h-[150px] breathe" />
          <div className="card h-56 breathe" />
        </>
      )}

      {step === "input" && (
        <section className="glow rise p-5">
          {missed && <p className="mb-4 text-[15px] font-medium text-text">Missed yesterday. Today&apos;s task is smaller.</p>}
          <label htmlFor="building" className="label">What are you building today?</label>
          <textarea
            id="building"
            rows={3}
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) breakStall();
            }}
            placeholder="Plain words. e.g. “Film my first YouTube video but I need a better camera first”"
            className="field mt-3 resize-none leading-relaxed"
          />
          <button onClick={breakStall} disabled={!building.trim()} className="btn btn-primary mt-4 w-full">
            Break the stall
          </button>
        </section>
      )}

      {step === "thinking" && (
        <section className="glow rise p-6">
          <p className="label">Finding the real stall</p>
          <p className="mt-3 text-muted">&ldquo;{building}&rdquo;</p>
          <div className="mt-5 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="breathe h-1.5 w-8 rounded-full bg-accent" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </section>
      )}

      {step === "task" && shown && (
        <section className="glow rise p-5">
          {missed && !active && <p className="mb-3 text-[15px] font-medium">Missed yesterday. Today&apos;s task is smaller.</p>}
          {shown.callout && <p className="glow-text text-[19px] font-semibold leading-snug">{shown.callout}</p>}

          {shown.research && shown.research.length > 0 && (
            <div className="mt-4 rounded-2xl border border-line bg-black/30 p-4">
              <p className="label">Research · handled</p>
              <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-text/85">
                {shown.research.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent-hi">→</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 border-t border-line pt-5">
            <p className="label">Tonight&apos;s ugly version</p>
            <p className="mt-2 text-[22px] font-semibold leading-snug">{shown.task}</p>
            <p className="mt-3 text-[14px] text-muted">
              <span className="text-text/80">Finish line:</span> {shown.finish_line}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="pill pill-muted">{shown.minutes} min</span>
              {shown.proof_hint && <span className="pill pill-muted font-medium">Proof: {shown.proof_hint}</span>}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-[1fr_auto] gap-2">
            <button onClick={start} disabled={busy} className="btn btn-primary">
              Start {shown.minutes}:00
            </button>
            <button onClick={tooBig} disabled={busy} className="btn btn-ghost">
              {busy ? "…" : "Too big"}
            </button>
          </div>
        </section>
      )}

      {step === "timer" && active && (
        <Timer promise={active} onDone={() => setStep("proof")} />
      )}

      {step === "proof" && active && (
        <section className="glow rise p-5">
          <p className="label">Proof or it didn&apos;t happen</p>
          <p className="mt-2 text-[17px] font-semibold leading-snug">{active.task}</p>
          <p className="mt-1 text-[14px] text-muted">{active.finish_line}</p>
          <ProofForm busy={busy} onSubmit={submitProof} onBack={() => setStep("timer")} />
        </section>
      )}

      {step === "kept" && active && (
        <section className="glow rise p-6 text-center">
          <span className="pill pill-kept">✓ Kept</span>
          <p className="glow-text mt-4 font-display text-[64px] leading-[0.85] tracking-wide">
            {keptLast30(rows)} / 30
          </p>
          <p className="mt-2 text-muted">On the ledger. That&apos;s evidence, not a feeling.</p>
          <button onClick={another} className="btn btn-ghost mt-6 w-full">Go again</button>
        </section>
      )}

      {error && <p className="text-center text-[14px] text-missed">{error}</p>}
    </div>
  );
}
