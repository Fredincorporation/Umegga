-- Umegga laws: first-class table for enacted laws so they are directly
-- queryable and fetched explicitly, instead of living only inside the
-- Umegga_game_state JSON snapshot.

create table if not exists public.Umegga_laws (
  id text primary key,
  title text not null,
  author text not null,
  edict text not null,
  category text,
  passed_at text,
  effect jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists Umegga_laws_created_at_idx
  on public.Umegga_laws (created_at desc);

alter table public.Umegga_laws enable row level security;

-- Anonymous-access policies mirroring the other Umegga_* tables. Replace with
-- auth.uid()-scoped policies before exposing private worlds in production.
drop policy if exists "Umegga_laws_public_read" on public.Umegga_laws;
create policy "Umegga_laws_public_read"
  on public.Umegga_laws for select
  using (true);

drop policy if exists "Umegga_laws_public_insert" on public.Umegga_laws;
create policy "Umegga_laws_public_insert"
  on public.Umegga_laws for insert
  with check (true);

drop policy if exists "Umegga_laws_public_update" on public.Umegga_laws;
create policy "Umegga_laws_public_update"
  on public.Umegga_laws for update
  using (true)
  with check (true);

drop policy if exists "Umegga_laws_public_delete" on public.Umegga_laws;
create policy "Umegga_laws_public_delete"
  on public.Umegga_laws for delete
  using (true);
