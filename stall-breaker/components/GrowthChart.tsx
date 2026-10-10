import { daysAgo, type PromiseEntry } from "@/lib/store";

// Running total of kept promises: it only ever goes up or holds. Flat stretches are the misses.
export default function GrowthChart({ rows, days = 30, height = 88 }: { rows: PromiseEntry[]; days?: number; height?: number }) {
  const daily = Array.from({ length: days }, (_, i) => {
    const d = daysAgo(days - 1 - i);
    return rows.filter((r) => r.date === d && r.status === "kept").length;
  });
  const series = daily.map((_, i) => daily.slice(0, i + 1).reduce((a, b) => a + b, 0));
  const total = series[series.length - 1];
  const max = Math.max(4, total);
  const W = 300;
  const H = 100;
  const pts = series.map((v, i) => [(i / (days - 1)) * W, H - 4 - (v / max) * (H - 12)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ex, ey] = pts[pts.length - 1];

  return (
    <div>
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <linearGradient id="growth-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.33, 0.66].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#26232e" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#growth-fill)" />
          <path
            d={line}
            fill="none"
            stroke="#b794ff"
            strokeWidth="2.25"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ filter: "drop-shadow(0 0 6px rgba(139,92,246,0.9))" }}
          />
        </svg>
        <span
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent-hi bg-bg shadow-[0_0_12px_rgba(183,148,255,0.9)]"
          style={{ left: `${(ex / W) * 100}%`, top: `${(ey / H) * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
        <span>{days} days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}
