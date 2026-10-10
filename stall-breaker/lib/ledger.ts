"use client";

import { staleOpen } from "./score";
import { listPromises, today, updatePromise } from "./store";

export async function loadLedger() {
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
