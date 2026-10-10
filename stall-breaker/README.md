# Stall Breaker

Sit down. Ship one ugly thing. Prove it.

Three screens:
- **Today**: say what you're building → the app calls out common excuses → you write 2-5 micro-steps (step 1 is 2 min, steps max 8 min, 30 min total, no "figure out" steps) → one step on screen at a time → proof (link, screenshot, text, or file) → kept.
- **Ledger**: every promise with its proof, kept/missed, and a growth chart of kept promises.
- **Setback**: rant → "What can you get from this?" → one next move, sent straight to Today.

No AI and no API costs: the coaching is rules in `lib/coach.ts`.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in what you have
npm run dev
```

With no keys it still runs in local mode: no login, ledger saved in that browser only. Add Supabase for logins and a real ledger.

## Set up for real (about 15 minutes)

### 1. Supabase (login + ledger)
1. Create a project at supabase.com.
2. **SQL Editor** → paste all of `supabase/migrations/001_init.sql` → Run. This creates the `promises` table and the private `proof` storage bucket, locked so each user only sees their own.
3. **Authentication → Sign In / Providers**: make sure Email is on.
4. **Authentication → URL Configuration**: set Site URL to your Vercel URL (e.g. `https://stall-breaker.vercel.app`) and add `https://stall-breaker.vercel.app/auth/callback` to Redirect URLs.
5. **Project Settings → API**: copy the Project URL and the `anon` public key.

### 2. Vercel
1. Import the GitHub repo.
2. **Root Directory**: `stall-breaker`.
3. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Send your clients the URL; they log in with their email.

## Where things live
- `lib/coach.ts`: the excuse call-outs, step rules (minutes, caps, banned "thinking" words), and the weekly stewardship review. Edit here to change how it coaches.
- `app/(app)/today`, `ledger`, `setback`: the three screens.
- `supabase/migrations/001_init.sql`: the database.
