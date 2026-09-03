// Deletes all active laws from the persisted game snapshot in Supabase and
// clears the Umegga_laws table (if the migration has been applied).
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

// 1) Clear world.activeLaws inside the Umegga_game_state snapshot.
const gsRes = await fetch(`${url}/rest/v1/Umegga_game_state?id=eq.global&select=state`, { headers: h });
const [gs] = await gsRes.json();
if (!gs?.state) {
  console.log('No game snapshot found; nothing to clear.');
} else {
  const before = gs.state?.world?.activeLaws?.length ?? 0;
  console.log('active laws in snapshot before:', before, (gs.state.world.activeLaws || []).map((l) => l.title));
  gs.state.world.activeLaws = [];
  const patchRes = await fetch(`${url}/rest/v1/Umegga_game_state?id=eq.global`, {
    method: 'PATCH',
    headers: { ...h, Prefer: 'return=minimal' },
    body: JSON.stringify({ state: gs.state, updated_at: new Date().toISOString() }),
  });
  console.log('snapshot patch:', patchRes.status, patchRes.ok ? 'OK' : await patchRes.text());
}

// 2) Clear the Umegga_laws table (only if migration 004 has been applied).
const delRes = await fetch(`${url}/rest/v1/Umegga_laws?id=neq.__none__`, {
  method: 'DELETE',
  headers: { ...h, Prefer: 'return=representation' },
});
if (delRes.ok) {
  const removed = await delRes.json();
  console.log('Umegga_laws cleared, removed rows:', Array.isArray(removed) ? removed.length : removed);
} else {
  console.log('Umegga_laws not available yet:', delRes.status);
}

// 3) Verify.
const verify = await fetch(`${url}/rest/v1/Umegga_game_state?id=eq.global&select=state`, { headers: h });
const [vgs] = await verify.json();
console.log('active laws after:', vgs?.state?.world?.activeLaws?.length ?? 0);
