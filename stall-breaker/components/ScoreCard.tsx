import { keptLast30, keptThisWeek } from "@/lib/score";
import { daysAgo, type PromiseEntry } from "@/lib/store";

export default function ScoreCard({ rows }: { rows: PromiseEntry[] }) {
  const kept = keptLast30(rows);
  const week = keptThisWeek(rows);

  // One tick per day, oldest → today. Evidence, not decoration.
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = daysAgo(29 - i);
    const onDay = rows.filter((r) => r.date === d);
    if (onDay.some((r) => r.status === "kept")) return "kept";
    if (onDay.some((r) => r.status === "missed")) return "missed";
    if (onDay.some((r) => r.status === "open")) return "open";
    return "none";
  });

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="label">Self-trust</p>
          <div className="mt-2 flex items-end gap-3">
            <span className="font-display text-[76px] leading-[0.8] tabular-nums">{kept}</span>
            <span className="mb-1 font-display text-[22px] leading-none tracking-wide text-muted">
              KEPT / 30 DAYS
            </span>
          </div>
        </div>
        <span className={`pill ${week > 0 ? "pill-kept" : "pill-muted"}`}>
          {week > 0 ? "▲" : ""} {week} this week
        </span>
      </div>
      <div className="mt-5 flex gap-[3px]" aria-label="Last 30 days">
        {days.map((s, i) => (
          <span
            key={i}
            className={`h-5 flex-1 rounded-[3px] ${
              s === "kept"
                ? "bg-kept"
                : s === "missed"
                  ? "bg-missed/70"
                  : s === "open"
                    ? "border border-accent bg-accent/25"
                    : "bg-line/70"
            }`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </section>
  );
}
