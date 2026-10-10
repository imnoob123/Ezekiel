import { daysAgo, today, type PromiseEntry } from "./store";

export const keptLast30 = (rows: PromiseEntry[]) => {
  const since = daysAgo(29);
  return rows.filter((r) => r.status === "kept" && r.date >= since).length;
};

export const keptThisWeek = (rows: PromiseEntry[]) => {
  const since = daysAgo(6);
  return rows.filter((r) => r.status === "kept" && r.date >= since).length;
};

// Open promises from an earlier day were never proven, so they're missed.
export const staleOpen = (rows: PromiseEntry[]) =>
  rows.filter((r) => r.status === "open" && r.date < today());

// "Missed yesterday" = they'd started using the app before, and nothing got kept yesterday.
export const missedYesterday = (rows: PromiseEntry[]) => {
  const y = daysAgo(1);
  const usedBefore = rows.some((r) => r.date <= y);
  return usedBefore && !rows.some((r) => r.date === y && r.status === "kept");
};
