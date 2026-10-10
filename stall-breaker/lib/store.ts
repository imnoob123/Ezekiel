"use client";

import { hasSupabase } from "./supabase/config";
import { supabaseBrowser } from "./supabase/client";

export type Status = "open" | "kept" | "missed";
export type ProofType = "link" | "image" | "text" | "file";

export type Step = { text: string; minutes: number };

export type PromiseEntry = {
  id: string;
  date: string; // YYYY-MM-DD, user's local day
  building: string;
  task: string;
  finish_line: string;
  proof_hint: string | null;
  callout: string | null;
  steps: Step[];
  steps_done: number;
  minutes: number;
  status: Status;
  started_at: string | null;
  proof_type: ProofType | null;
  proof_text: string | null;
  proof_path: string | null;
  created_at: string;
  completed_at: string | null;
};

export type NewPromise = Omit<
  PromiseEntry,
  "id" | "status" | "steps_done" | "started_at" | "proof_type" | "proof_text" | "proof_path" | "created_at" | "completed_at"
>;

export const today = (d = new Date()) => d.toLocaleDateString("en-CA");
export const daysAgo = (n: number) => today(new Date(Date.now() - n * 86_400_000));

// ---- Local mode (no Supabase env): this browser only ----
const KEY = "stallbreaker.promises";
const readLocal = (): PromiseEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
};
const writeLocal = (rows: PromiseEntry[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {}
};

export async function listPromises(): Promise<PromiseEntry[]> {
  if (!hasSupabase) return readLocal().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const { data, error } = await supabaseBrowser()
    .from("promises")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data as PromiseEntry[];
}

export async function createPromise(p: NewPromise): Promise<PromiseEntry> {
  if (!hasSupabase) {
    const row: PromiseEntry = {
      ...p,
      id: crypto.randomUUID(),
      status: "open",
      steps_done: 0,
      started_at: null,
      proof_type: null,
      proof_text: null,
      proof_path: null,
      created_at: new Date().toISOString(),
      completed_at: null,
    };
    writeLocal([row, ...readLocal()]);
    return row;
  }
  const { data, error } = await supabaseBrowser().from("promises").insert(p).select().single();
  if (error) throw error;
  return data as PromiseEntry;
}

export async function updatePromise(id: string, patch: Partial<PromiseEntry>): Promise<PromiseEntry> {
  if (!hasSupabase) {
    const rows = readLocal().map((r) => (r.id === id ? { ...r, ...patch } : r));
    writeLocal(rows);
    return rows.find((r) => r.id === id)!;
  }
  const { data, error } = await supabaseBrowser().from("promises").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as PromiseEntry;
}

export async function uploadProof(file: File): Promise<string> {
  if (!hasSupabase) return `local/${file.name}`;
  const sb = supabaseBrowser();
  const { data: auth } = await sb.auth.getUser();
  const path = `${auth.user!.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await sb.storage.from("proof").upload(path, file);
  if (error) throw error;
  return path;
}

// Short-lived link to a private proof upload.
export async function proofUrl(path: string): Promise<string | null> {
  if (!hasSupabase || path.startsWith("local/")) return null;
  const { data } = await supabaseBrowser().storage.from("proof").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
