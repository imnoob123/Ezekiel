"use client";

import { useEffect, useState } from "react";
import type { PromiseEntry } from "@/lib/store";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function Timer({ promise, onDone }: { promise: PromiseEntry; onDone: () => void }) {
  const total = promise.minutes * 60;
  const startedAt = Date.parse(promise.started_at!);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const left = Math.max(0, total - elapsed);
  const over = left === 0;

  return (
    <section className="glow rise p-6">
      <p className="label">{over ? "Time" : "Clock's running"}</p>
      <p className="glow-text mt-3 text-center font-display text-[120px] leading-[0.8] tabular-nums tracking-wide">
        {fmt(left)}
      </p>
      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent shadow-[0_0_14px_rgba(139,92,246,0.9)] transition-[width] duration-1000 ease-linear"
          style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }}
        />
      </div>
      <p className="mt-6 text-[17px] font-semibold leading-snug">{promise.task}</p>
      <p className="mt-1 text-[14px] text-muted">{promise.finish_line}</p>
      {over && <p className="mt-4 text-[15px] text-text">Finished or not, show what you&apos;ve got.</p>}
      <button onClick={onDone} className="btn btn-primary mt-6 w-full">
        Done · add proof
      </button>
    </section>
  );
}
