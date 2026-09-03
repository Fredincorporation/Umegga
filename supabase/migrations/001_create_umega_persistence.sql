-- Umegga persistence foundation
-- The current client writes agent rows and will use umega_game_state for the
-- complete snapshot: player, agents, personalities, memories, relationships,
-- goals, quests, world, chronicles, laws, messages, interventions, and God Mode.

create table if not exists public.umega_agents (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.umega_game_state (
  id text primary key default 'global',
  state jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint umega_game_state_singleton check (id = 'global')
);

create table if not exists public.umega_world_events (
  id text primary key,
  event_type text not null check (event_type in ('story', 'law', 'build', 'alliance', 'goal', 'intervention', 'personality')),
  payload jsonb not null,
  session_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.umega_chat_messages (
  id text primary key,
  message jsonb not null,
  session_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists umega_agents_updated_at_idx
  on public.umega_agents (updated_at desc);

create index if not exists umega_world_events_created_at_idx
  on public.umega_world_events (created_at desc);

create index if not exists umega_world_events_type_created_at_idx
  on public.umega_world_events (event_type, created_at desc);

create index if not exists umega_chat_messages_created_at_idx
  on public.umega_chat_messages (created_at desc);

alter table public.umega_agents enable row level security;
alter table public.umega_game_state enable row level security;
alter table public.umega_world_events enable row level security;
alter table public.umega_chat_messages enable row level security;

-- Umegga currently has no login/session identity, so these policies support the
-- existing anonymous prototype. Replace them with auth.uid()-scoped policies
-- before exposing private worlds or player-specific data in production.
drop policy if exists "umega_agents_public_read" on public.umega_agents;
create policy "umega_agents_public_read"
  on public.umega_agents for select
  using (true);

drop policy if exists "umega_agents_public_write" on public.umega_agents;
create policy "umega_agents_public_write"
  on public.umega_agents for insert
  with check (true);

drop policy if exists "umega_agents_public_update" on public.umega_agents;
create policy "umega_agents_public_update"
  on public.umega_agents for update
  using (true)
  with check (true);

drop policy if exists "umega_game_state_public_read" on public.umega_game_state;
create policy "umega_game_state_public_read"
  on public.umega_game_state for select
  using (true);

drop policy if exists "umega_game_state_public_write" on public.umega_game_state;
create policy "umega_game_state_public_write"
  on public.umega_game_state for insert
  with check (id = 'global');

drop policy if exists "umega_game_state_public_update" on public.umega_game_state;
create policy "umega_game_state_public_update"
  on public.umega_game_state for update
  using (id = 'global')
  with check (id = 'global');

drop policy if exists "umega_world_events_public_read" on public.umega_world_events;
create policy "umega_world_events_public_read"
  on public.umega_world_events for select
  using (true);

drop policy if exists "umega_world_events_public_write" on public.umega_world_events;
create policy "umega_world_events_public_write"
  on public.umega_world_events for insert
  with check (true);

drop policy if exists "umega_chat_messages_public_read" on public.umega_chat_messages;
create policy "umega_chat_messages_public_read"
  on public.umega_chat_messages for select
  using (true);

drop policy if exists "umega_chat_messages_public_write" on public.umega_chat_messages;
create policy "umega_chat_messages_public_write"
  on public.umega_chat_messages for insert
  with check (true);

-- Enable Supabase Realtime for event history. The DO block keeps this migration
-- rerunnable when a table has already been added to the publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'umega_world_events'
  ) then
    alter publication supabase_realtime add table public.umega_world_events;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'umega_chat_messages'
  ) then
    alter publication supabase_realtime add table public.umega_chat_messages;
  end if;
end
$$;
