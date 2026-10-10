export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// No Supabase env → "local mode": no login, ledger lives in this browser. Handy for dev and demos.
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
