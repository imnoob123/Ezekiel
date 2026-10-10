"use client";

import Link from "next/link";
import { useState } from "react";

type Stage = "rant" | "listening" | "answer" | "thinking" | "move";

async function coach(body: object) {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "setback", ...body }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Something broke.");
  return json;
}

export default function Setback() {
  const [stage, setStage] = useState<Stage>("rant");
  const [rant, setRant] = useState("");
  const [reply, setReply] = useState("");
  const [answer, setAnswer] = useState("");
  const [move, setMove] = useState<{ leverage: string; next_move: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function vent() {
    setError(null);
    setStage("listening");
    try {
      const { text } = await coach({ rant });
      setReply(text);
      setStage("answer");
    } catch (e) {
      setError((e as Error).message);
      setStage("rant");
    }
  }

  async function findLeverage() {
    setError(null);
    setStage("thinking");
    try {
      setMove(await coach({ rant, answer }));
      setStage("move");
    } catch (e) {
      setError((e as Error).message);
      setStage("answer");
    }
  }

  function reset() {
    setRant("");
    setReply("");
    setAnswer("");
    setMove(null);
    setStage("rant");
  }

  const [line, question] = reply.split(/\n+(?=What can you get)/);

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
            placeholder="No filter. Nobody reads this but you."
            className="field mt-3 resize-none leading-relaxed"
          />
          <button onClick={vent} disabled={!rant.trim()} className="btn btn-primary mt-4 w-full">
            That&apos;s it
          </button>
        </section>
      )}

      {(stage === "listening" || stage === "thinking") && (
        <section className="glow rise flex flex-col items-center p-8">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="breathe h-1.5 w-8 rounded-full bg-accent" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <p className="label mt-4">{stage === "listening" ? "Reading it" : "Finding the leverage"}</p>
        </section>
      )}

      {stage === "answer" && (
        <section className="glow rise p-5">
          {line && <p className="text-[15px] leading-snug text-text/80">{line}</p>}
          <p className="glow-text mt-3 text-[24px] font-semibold leading-tight">{question ?? "What can you get from this?"}</p>
          <textarea
            rows={4}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="A lesson, a story, a decision it made for you…"
            className="field mt-4 resize-none leading-relaxed"
          />
          <button onClick={findLeverage} disabled={!answer.trim()} className="btn btn-primary mt-4 w-full">
            Next move
          </button>
        </section>
      )}

      {stage === "move" && move && (
        <section className="glow rise p-5">
          <p className="label">The leverage</p>
          <p className="mt-1.5 text-[16px] leading-snug text-text/85">{move.leverage}</p>
          <p className="label mt-6">One next move</p>
          <p className="glow-text mt-1.5 text-[24px] font-semibold leading-tight">{move.next_move}</p>
          <Link href={`/today?b=${encodeURIComponent(move.next_move)}`} className="btn btn-primary mt-6 w-full">
            Make it today&apos;s task
          </Link>
          <button onClick={reset} className="btn btn-ghost mt-2 w-full">Done</button>
        </section>
      )}

      {error && <p className="text-center text-[14px] text-missed">{error}</p>}
    </div>
  );
}
