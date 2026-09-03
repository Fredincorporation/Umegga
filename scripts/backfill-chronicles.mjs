// Backfills Umegga_chronicles from the chronicles embedded in the
// Umegga_game_state snapshot (mimics the in-app backfill on first load).
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

const gsRes = await fetch(`${url}/rest/v1/Umegga_game_state?id=eq.global&select=state`, { headers: h });
const [gs] = await gsRes.json();
const chronicles = gs?.state?.world?.chronicles || [];
console.log('snapshot chronicles to backfill:', chronicles.length);

for (const story of chronicles) {
  const row = {
    id: story.id,
    title: story.title,
    author: story.author,
    summary: story.summary ?? null,
    content: story.content,
    full_content: story.fullContent ?? story.content,
    chronicle_time: story.timestamp ?? null,
    impact_summary: story.impactSummary ?? null,
    visual_effect_type: story.visualEffectType ?? null,
    resonance: story.resonance ?? 75,
    enacted: story.enacted ?? true,
    created_at: new Date().toISOString(),
  };
  const res = await fetch(`${url}/rest/v1/Umegga_chronicles?on_conflict=id`, {
    method: 'POST',
    headers: { ...h, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(row),
  });
  console.log(`${story.title} -> ${res.status}${res.ok ? '' : ' ' + (await res.text())}`);
}

const verify = await fetch(`${url}/rest/v1/Umegga_chronicles?select=id,title,author&order=created_at.desc`, { headers: h });
const rows = await verify.json();
console.log('table now contains:', verify.status, Array.isArray(rows) ? rows.length : rows, 'rows');
for (const r of Array.isArray(rows) ? rows : []) console.log(`  "${r.title}" by ${r.author} (${r.id})`);
