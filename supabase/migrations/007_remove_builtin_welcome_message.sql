-- Chat history is database-backed; remove the client-seeded welcome message.
delete from public.umega_chat_messages
where id = 'msg_welcome';

update public.umega_game_state
set state = state - 'messages', updated_at = timezone('utc', now())
where id = 'global';
