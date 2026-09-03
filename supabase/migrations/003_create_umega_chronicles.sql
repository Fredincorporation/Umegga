-- Umegga chronicles: first-class table for woven stories so they are directly
-- queryable and fetched explicitly, instead of living only inside the
-- Umegga_game_state JSON snapshot.

create table if not exists public.Umegga_chronicles (
  id text primary key,
  title text not null,
  author text not null,
  summary text,
  content text not null,
  full_content text,
  chronicle_time text,
  impact_summary text,
  visual_effect_type text,
  resonance integer not null default 75,
  enacted boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists Umegga_chronicles_created_at_idx
  on public.Umegga_chronicles (created_at desc);

alter table public.Umegga_chronicles enable row level security;

-- Anonymous-access policies mirroring the other Umegga_* tables. Replace with
-- auth.uid()-scoped policies before exposing private worlds in production.
drop policy if exists "Umegga_chronicles_public_read" on public.Umegga_chronicles;
create policy "Umegga_chronicles_public_read"
  on public.Umegga_chronicles for select
  using (true);

drop policy if exists "Umegga_chronicles_public_insert" on public.Umegga_chronicles;
create policy "Umegga_chronicles_public_insert"
  on public.Umegga_chronicles for insert
  with check (true);

drop policy if exists "Umegga_chronicles_public_update" on public.Umegga_chronicles;
create policy "Umegga_chronicles_public_update"
  on public.Umegga_chronicles for update
  using (true)
  with check (true);

-- Remove diagnostic rows created while verifying write access.
delete from public.Umegga_world_events where id like 'diag_story_%';
