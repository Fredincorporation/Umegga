-- Umegga audio playback state (music track + resume position).
-- Replaces the previous browser localStorage keys 'Umegga-music-track' and
-- 'Umegga-music-position' so nothing is cached client-side.

create table if not exists public.Umegga_audio_state (
  id text primary key default 'global',
  track_index integer not null default 0,
  position_seconds double precision not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint Umegga_audio_state_singleton check (id = 'global')
);

alter table public.Umegga_audio_state enable row level security;

-- Umegga has no login/session identity yet; these mirror the anonymous-access
-- policies used by the other Umegga_* tables. Replace with auth.uid()-scoped
-- policies before exposing private worlds or player-specific data.
drop policy if exists "Umegga_audio_state_public_read" on public.Umegga_audio_state;
create policy "Umegga_audio_state_public_read"
  on public.Umegga_audio_state for select
  using (true);

drop policy if exists "Umegga_audio_state_public_insert" on public.Umegga_audio_state;
create policy "Umegga_audio_state_public_insert"
  on public.Umegga_audio_state for insert
  with check (id = 'global');

drop policy if exists "Umegga_audio_state_public_update" on public.Umegga_audio_state;
create policy "Umegga_audio_state_public_update"
  on public.Umegga_audio_state for update
  using (id = 'global')
  with check (id = 'global');
