-- Stall Breaker v1: the Ledger.
create table if not exists public.promises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  building text not null,
  task text not null,
  finish_line text not null,
  proof_hint text,
  callout text,
  research jsonb,
  minutes int not null,
  status text not null default 'open' check (status in ('open', 'kept', 'missed')),
  started_at timestamptz,
  proof_type text check (proof_type in ('link', 'image', 'text', 'file')),
  proof_text text,
  proof_path text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  -- No proof, no "kept".
  constraint kept_needs_proof check (status <> 'kept' or proof_type is not null)
);

create index if not exists promises_user_date on public.promises (user_id, date desc);

alter table public.promises enable row level security;
create policy "own promises" on public.promises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Proof uploads (screenshots, files). Private; each user can only touch their own folder.
insert into storage.buckets (id, name, public) values ('proof', 'proof', false)
  on conflict (id) do nothing;

create policy "own proof read" on storage.objects for select
  using (bucket_id = 'proof' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own proof write" on storage.objects for insert
  with check (bucket_id = 'proof' and (storage.foldername(name))[1] = auth.uid()::text);
