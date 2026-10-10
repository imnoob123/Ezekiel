import { NextResponse } from "next/server";
import { diagnose, hasClaude, setbackListen, setbackMove, shrink, weeklyReview } from "@/lib/claude";
import { mockDiagnose, mockListen, mockMove, mockReview, mockShrink } from "@/lib/mock";
import { hasSupabase } from "@/lib/supabase/config";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  // Keep the API key from being used by anyone who isn't logged in.
  if (hasSupabase) {
    const { data } = await (await supabaseServer()).auth.getUser();
    if (!data.user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await req.json();
  const live = hasClaude();

  try {
    switch (body.mode) {
      case "diagnose": {
        const building = String(body.building ?? "").slice(0, 2000);
        if (!building.trim()) return NextResponse.json({ error: "Say what you're building." }, { status: 400 });
        const missedYesterday = Boolean(body.missedYesterday);
        const task = live
          ? await diagnose({ building, missedYesterday, recent: body.recent ?? [] })
          : mockDiagnose(building, missedYesterday);
        return NextResponse.json(task);
      }
      case "shrink": {
        const minutes = Number(body.minutes) || 25;
        const task = live
          ? await shrink({
              building: String(body.building ?? ""),
              task: String(body.task ?? ""),
              minutes,
              steps: Array.isArray(body.steps) ? body.steps.map(String).slice(0, 5) : [],
            })
          : mockShrink();
        return NextResponse.json(task);
      }
      case "review": {
        const text = live ? await weeklyReview(body.entries ?? []) : mockReview;
        return NextResponse.json({ text });
      }
      case "setback": {
        const rant = String(body.rant ?? "").slice(0, 6000);
        if (!rant.trim()) return NextResponse.json({ error: "Get it out first." }, { status: 400 });
        if (!body.answer) {
          return NextResponse.json({ text: live ? await setbackListen(rant) : mockListen });
        }
        const answer = String(body.answer).slice(0, 3000);
        return NextResponse.json(live ? await setbackMove(rant, answer) : mockMove);
      }
      default:
        return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "AI hiccup. Hit it again." }, { status: 502 });
  }
}
