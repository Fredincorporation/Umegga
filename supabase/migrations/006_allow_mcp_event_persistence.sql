-- WebMCP execution logs are persisted alongside other world events.
alter table public.umega_world_events
  drop constraint if exists umega_world_events_event_type_check;

alter table public.umega_world_events
  add constraint umega_world_events_event_type_check
  check (event_type in ('story', 'law', 'build', 'alliance', 'goal', 'intervention', 'personality', 'mcp_call'));
