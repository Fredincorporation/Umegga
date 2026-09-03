-- Enacted stories and active laws are user/agent-created records only.
-- Remove the legacy rows that were previously seeded in the client.
delete from public.Umegga_chronicles
where id in ('story_genesis', 'story_verdant');

delete from public.Umegga_laws
where id in ('law_harmony', 'law_mana');
