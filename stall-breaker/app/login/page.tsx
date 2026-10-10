"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setState(error ? "error" : "sent");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-4">
      <h1 className="font-display text-[72px] leading-[0.85] tracking-wide">
        STALL
        <br />
        <span className="text-muted">BREAKER</span>
      </h1>
      <p className="mt-4 text-muted">Sit down. Ship one ugly thing. Prove it.</p>
      <form onSubmit={send} className="glow mt-8 p-5">
        <label className="label" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="field mt-2"
        />
        <button className="btn btn-primary mt-4 w-full" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send login link"}
        </button>
        {state === "sent" && <p className="mt-3 text-sm text-kept">Check your email for the link.</p>}
        {state === "error" && <p className="mt-3 text-sm text-missed">Couldn&apos;t send it. Try again.</p>}
      </form>
    </main>
  );
}
