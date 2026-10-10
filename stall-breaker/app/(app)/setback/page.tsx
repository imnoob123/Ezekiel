"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isThinkingStep } from "@/lib/coach";

export default function Setback() {
  const router = useRouter();
  const [stage, setStage] = useState<"rant" | "leverage">("rant");
  const [rant, setRant] = useState("");
  const [leverage, setLeverage] = useState("");
  const [move, setMove] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function toToday() {
    if (!leverage.trim()) return setErr("Find one thing you can get from it first.");
    if (!move.trim()) return setErr("Write one next move.");
    if (isThinkingStep(move)) return setErr("That's a thinking move. What will you actually do?");
    router.push(`/today?b=${encodeURIComponent(move.trim())}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="pb-1 font-display text-[56px] leading-[0.8] tracking-wide">SETBACK</h1>

      {stage === "rant" && (
        <section className="glow rise p-5">
          <label htmlFor="rant" className="label">What happened? Get it all out.</label>
          <textarea
            id="rant"
            rows={8}
            value={rant}
            onChange={(e) => setRant(e.target.value)}
            placeholder="No filter. Nothing here gets saved."
            className="field mt-3 resize-none leading-relaxed"
          />
          <button onClick={() => setStage("leverage")} disabled={!rant.trim()} className="btn btn-primary mt-4 w-full">
            That&apos;s it
          </button>
        </section>
      )}

      {stage === "leverage" && (
        <section className="glow rise p-5">
          <p className="text-[15px] text-text/70">Okay. It&apos;s out of your head.</p>
          <p className="glow-text mt-2 text-[24px] font-semibold leading-tight">What can you get from this?</p>
          <textarea
            rows={3}
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            placeholder="A lesson, a story, a decision it made for you…"
            className="field mt-4 resize-none leading-relaxed"
          />

          <label htmlFor="move" className="label mt-5 block">One next move · next 24 hours</label>
          <input
            id="move"
            value={move}
            onChange={(e) => setMove(e.target.value)}
            placeholder="Start with a verb. Something you can prove."
            className="field mt-2 h-11 px-3 py-0 text-[15px]"
          />

          {err && <p className="mt-3 text-[14px] text-missed">{err}</p>}

          <button onClick={toToday} className="btn btn-primary mt-5 w-full">
            Make it today&apos;s task
          </button>
          <button
            onClick={() => {
              setRant("");
              setLeverage("");
              setMove("");
              setErr(null);
              setStage("rant");
            }}
            className="label mt-4 block w-full text-center hover:text-text"
          >
            Done for now
          </button>
        </section>
      )}
    </div>
  );
}
