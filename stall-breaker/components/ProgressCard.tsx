import GrowthChart from "./GrowthChart";
import { keptLast30, keptThisWeek } from "@/lib/score";
import type { PromiseEntry } from "@/lib/store";

export default function ProgressCard({ rows }: { rows: PromiseEntry[] }) {
  const kept = keptLast30(rows);
  const week = keptThisWeek(rows);
  return (
    <section className="card px-5 pb-4 pt-5">
      <div className="mb-4 flex items-end justify-between">
        <div className="flex items-end gap-2.5">
          <span className="font-display text-[56px] leading-[0.8] tabular-nums">{kept}</span>
          <span className="font-display text-[18px] leading-none tracking-wide text-muted">KEPT / 30 DAYS</span>
        </div>
        <span className={`pill ${week > 0 ? "pill-kept" : "pill-muted"}`}>
          {week > 0 && "▲"} {week} this week
        </span>
      </div>
      <GrowthChart rows={rows} />
    </section>
  );
}
