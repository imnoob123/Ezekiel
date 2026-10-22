import { NextResponse } from "next/server";
import { hasLlm, chat } from "@/lib/llm";
import { hasSupabase } from "@/lib/supabase/config";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60;

export const GET = async () => NextResponse.json({ enabled: hasLlm() });

const SYSTEM = `You break a task into tiny physical micro-steps for someone who stalls.
Rules: 2 to 5 steps. Step 1 takes 2 minutes. Every other step takes 2, 5 or 8 minutes. Total at most {MAX} minutes.
Each step is a physical action (open, write, record, save), never thinking, researching, planning or deciding.
Also give a "finish" line: what "done" looks like, short, starting after "Done when".
Reply with JSON only: {"steps":[{"text":"...","minutes":2}],"finish":"..."}`;

export async function POST(req: Request) {
  if (!hasLlm()) return NextResponse.json({ error: "AI isn't set up." }, { status: 404 });

  // Don't let anonymous visitors spend the free-tier quota.
  if (hasSupabase) {
    const { data } = await (await supabaseServer()).auth.getUser();
    if (!data.user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await req.json();
  const building = String(body.building ?? "").slice(0, 2000).trim();
  if (!building) return NextResponse.json({ error: "Say what you're building." }, { status: 400 });
  const max = body.missed ? 15 : 30;

  try {
    const raw = await chat(SYSTEM.replace("{MAX}", String(max)), building);
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const steps = (Array.isArray(json.steps) ? json.steps : [])
      .slice(0, body.missed ? 3 : 5)
      .map((s: { text?: unknown; minutes?: unknown }, i: number) => ({
        text: String(s.text ?? "").slice(0, 200),
        minutes: i === 0 ? 2 : [2, 5, 8].includes(Number(s.minutes)) ? Number(s.minutes) : 5,
      }));
    return NextResponse.json({ steps, finish: String(json.finish ?? "").slice(0, 200) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "AI hiccup. Write them yourself or try again." }, { status: 502 });
  }
}
