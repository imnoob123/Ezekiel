"use client";

import { useEffect, useState } from "react";
import GrowthChart from "@/components/GrowthChart";
import { loadLedger } from "@/lib/ledger";
import { keptLast30 } from "@/lib/score";
import { proofUrl, type PromiseEntry } from "@/lib/store";

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();

function ProofLine({ row }: { row: PromiseEntry }) {
  if (row.status !== "kept" || !row.proof_type) return null;
  if (row.proof_type === "link" && row.proof_text) {
    let host = row.proof_text;
    try {
      host = new URL(row.proof_text).host.replace(/^www\./, "");
    } catch {}
    return (
      <a href={row.proof_text} target="_blank" rel="noreferrer" className="text-accent-hi hover:underline">
        ↗ {host}
      </a>
    );
  }
  if (row.proof_type === "text") return <span className="line-clamp-1">“{row.proof_text}”</span>;
  return (
    <button
      className="text-accent-hi hover:underline"
      onClick={async () => {
        const url = row.proof_path ? await proofUrl(row.proof_path) : null;
        if (url) window.open(url, "_blank");
      }}
    >
      {row.proof_type === "image" ? "▣" : "▤"} {row.proof_text ?? "file"}
    </button>
  );
}

export default function Ledger() {
  const [rows, setRows] = useState<PromiseEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadLedger()
      .then(({ list }) => setRows(list))
      .catch(() => setError(true));
  }, []);

  const kept = rows?.filter((r) => r.status === "kept").length ?? 0;
  const missed = rows?.filter((r) => r.status === "missed").length ?? 0;

  return (
    <div className="space-y-4">
      <h1 className="pb-1 font-display text-[56px] leading-[0.8] tracking-wide">LEDGER</h1>

      {!rows ? (
        <div className="card breathe h-[180px]" />
      ) : (
        <>
          <section className="card px-5 pb-4 pt-5">
            <div className="mb-4 flex items-end justify-between">
              <div className="flex items-end gap-2.5">
                <span className="font-display text-[56px] leading-[0.8] tabular-nums">{keptLast30(rows)}</span>
                <span className="font-display text-[18px] leading-none tracking-wide text-muted">KEPT / 30 DAYS</span>
              </div>
              <span className="label pb-0.5">
                {kept} kept · {missed} missed
              </span>
            </div>
            <GrowthChart rows={rows} />
          </section>

          {rows.length === 0 ? (
            <p className="card p-6 text-center text-muted">Nothing yet. Your first kept promise lands here.</p>
          ) : (
            <section className="card divide-y divide-line overflow-hidden">
              {rows.map((r) => (
                <details key={r.id} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-start gap-4">
                    <span className="w-12 shrink-0 pt-0.5 font-display text-[16px] leading-none tracking-wide text-faint">
                      {fmtDate(r.date)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{r.task}</span>
                      <span className="mt-1 block truncate text-[13px] text-muted">
                        <ProofLine row={r} />
                        {r.status === "missed" && "No proof"}
                        {r.status === "open" && "In progress"}
                      </span>
                    </span>
                    <span
                      className={`pill shrink-0 ${
                        r.status === "kept" ? "pill-kept" : r.status === "missed" ? "pill-missed" : "pill-muted"
                      }`}
                    >
                      {r.status === "kept" ? "✓" : r.status === "missed" ? "✕" : "•"}
                    </span>
                  </summary>
                  <div className="mt-3 space-y-2 pl-16 text-[13px] text-muted">
                    <p>
                      <span className="text-text/70">Building:</span> {r.building}
                    </p>
                    {r.steps?.length > 0 && (
                      <ol className="space-y-1">
                        {r.steps.map((s, i) => (
                          <li key={i} className={i < r.steps_done ? "text-text/80" : "text-faint"}>
                            {i < r.steps_done ? "✓" : "○"} {s.text}
                          </li>
                        ))}
                      </ol>
                    )}
                    {r.proof_type === "text" && r.proof_text && (
                      <p className="whitespace-pre-wrap rounded-xl border border-line bg-black/30 p-3 text-text/80">
                        {r.proof_text}
                      </p>
                    )}
                  </div>
                </details>
              ))}
            </section>
          )}
        </>
      )}
      {error && <p className="text-center text-[14px] text-missed">Couldn&apos;t load your ledger.</p>}
    </div>
  );
}
