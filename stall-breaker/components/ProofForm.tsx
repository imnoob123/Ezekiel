"use client";

import { useState } from "react";
import type { ProofType } from "@/lib/store";

export type Proof = { type: ProofType; text?: string; file?: File };

const TYPES: { id: ProofType; label: string }[] = [
  { id: "link", label: "Link" },
  { id: "image", label: "Screenshot" },
  { id: "text", label: "Text" },
  { id: "file", label: "File" },
];

// "done" is a claim, not proof.
const BARE_CLAIM = /^\s*(done|finished|did it|completed|complete|yes|ok|shipped)[\s.!]*$/i;

export default function ProofForm({
  busy,
  onSubmit,
  onBack,
}: {
  busy: boolean;
  onSubmit: (p: Proof) => void;
  onBack: () => void;
}) {
  const [type, setType] = useState<ProofType>("link");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setErr(null);
    if (type === "link") {
      try {
        const u = new URL(text.trim());
        if (!/^https?:$/.test(u.protocol)) throw 0;
      } catch {
        return setErr("That's not a link. Paste the full URL.");
      }
      return onSubmit({ type, text: text.trim() });
    }
    if (type === "text") {
      if (BARE_CLAIM.test(text) || text.trim().length < 20) {
        return setErr("Saying “done” isn't proof. Paste what you actually made.");
      }
      return onSubmit({ type, text: text.trim() });
    }
    if (!file) return setErr(type === "image" ? "Add the screenshot." : "Add the file.");
    if (file.size > 20 * 1024 * 1024) return setErr("Keep it under 20MB.");
    onSubmit({ type, file });
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-black/30 p-1">
        {TYPES.map((t) => (
          <button
            key={t.id}
            data-on={type === t.id}
            onClick={() => {
              setType(t.id);
              setErr(null);
            }}
            className="chip flex-1"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {type === "link" && (
          <input
            className="field"
            inputMode="url"
            placeholder="https://"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
        {type === "text" && (
          <textarea
            className="field resize-none"
            rows={5}
            placeholder="Paste the script, the copy, the outline. The actual thing."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
        {(type === "image" || type === "file") && (
          <label className="field flex cursor-pointer items-center justify-between gap-3">
            <span className={file ? "truncate text-text" : "text-faint"}>
              {file ? file.name : type === "image" ? "Choose a screenshot" : "Choose a file"}
            </span>
            <span className="label shrink-0">Browse</span>
            <input
              type="file"
              className="hidden"
              accept={type === "image" ? "image/*" : undefined}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>

      {err && <p className="mt-3 text-[14px] text-missed">{err}</p>}

      <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
        <button onClick={onBack} className="btn btn-ghost">Back</button>
        <button onClick={submit} disabled={busy} className="btn btn-primary">
          {busy ? "Logging…" : "Log it"}
        </button>
      </div>
    </div>
  );
}
