// Quick connectivity check: reads the global game-state row via the anon key.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

for (const table of ['umega_game_state', 'umega_agents', 'umega_chat_messages', 'umega_world_events', 'umega_audio_state', 'umega_chronicles', 'umega_laws']) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  console.log(table, '->', res.status, res.ok ? 'OK' : await res.text());
}
