import { NextResponse } from "next/server";
import { diagnose, hasClaude, research, shrink, weeklyReview } from "@/lib/claude";
import { mockDiagnose, mockResearch, mockReview, mockShrink } from "@/lib/mock";
import { hasSupabase } from "@/lib/supabase/config";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 120;

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
        const bullets = task.research_query
          ? live
            ? await research(task.research_query, building)
            : mockResearch
          : null;
        return NextResponse.json({ ...task, research: bullets });
      }
      case "shrink": {
        const minutes = Number(body.minutes) || 25;
        const task = live
          ? await shrink({ building: String(body.building ?? ""), task: String(body.task ?? ""), minutes })
          : mockShrink(minutes);
        return NextResponse.json({ ...task, research: null });
      }
      case "review": {
        const text = live ? await weeklyReview(body.entries ?? []) : mockReview;
        return NextResponse.json({ text });
      }
      default:
        return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "AI hiccup. Hit it again." }, { status: 502 });
  }
}
