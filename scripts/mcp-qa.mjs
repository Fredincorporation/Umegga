// Full WebMCP tool verification: injects a page-world script that calls all
// 19 registered tools via document.modelContext.callTool and reports results
// through localStorage (which is shared with the automation driver's world).
export default async function run(page) {
  // Wait until the app world is ready (registry + game instance exist)
  for (let i = 0; i < 90; i++) {
    await page.evaluate(() => {
      const s = document.createElement('script');
      s.textContent = `localStorage.setItem('qa_ready', String(!!window.UmeggaMCP && !!window.gameInstance));`;
      document.head.appendChild(s);
    });
    const ready = await page.evaluate(() => localStorage.getItem('qa_ready') === 'true');
    if (ready) break;
    await page.waitForTimeout(1000);
  }

  await page.evaluate(() => {
    const code = `
(async () => {
  const mc = window.UmeggaMCP;
  const results = [];
  const call = async (name, args) => {
    const started = performance.now();
    try {
      const result = await mc.callTool(name, args ?? {});
      results.push({ tool: name, ok: true, ms: Math.round(performance.now() - started) });
    } catch (e) {
      results.push({ tool: name, ok: false, ms: Math.round(performance.now() - started), error: String(e && e.message || e) });
    }
  };

  let agents = [];
  try { agents = (await mc.callTool('query_world_state', {})).agents || []; } catch (e) {}
  const agentId = agents[0] && agents[0].id;
  const allyId = agents[1] && agents[1].id;

  await call('query_world_state');
  await call('propose_story', { title: 'QA Tale ' + Date.now(), content: 'A testing chronicle.', impact: 'Reality shimmered.' });
  await call('propose_law', { title: 'QA Edict ' + Date.now(), edict: 'Tests shall pass.', category: 'Reality Edict', effectType: 'speed_boost', magnitude: 1.2 });
  await call('get_agent_state', { agentId });
  await call('set_agent_goal', { agentId, title: 'QA goal', description: 'Verify tools', priority: 5 });
  await call('spawn_agent', { characterId: 'aelira', name: 'QA Spawn', role: 'Tester', x: 500, y: 500 });
  await call('move_agent', { agentId, x: 300, y: 400 });
  await call('move', { agentId, x: 320, y: 420 });
  await call('build', { name: 'QA Tower', type: 'tower', scene: 'SanctuaryScene', x: 400, y: 300 });
  await call('communicate', { fromAgentId: agentId, toAgentId: allyId, message: 'Hello ally' });
  await call('form_alliance', { agentId, allyId });
  await call('spawn_agent_with_role', { characterId: 'torren', name: 'QA Role', role: 'Smith', goal: 'Forge tools' });
  await call('simulate_outcome', { action: 'test', risk: 0.2 });
  await call('narrate_event', { narrator: 'QA Oracle', message: 'Tool verification underway.' });
  await call('set_weather', { weather: 'aurora' });
  await call('travel_to_scene', { scene: 'OracleBasinScene' });
  await call('teleport_agent_to_scene', { agentId, scene: 'GrandForgeScene', x: 500, y: 500 });
  await call('get_quests');
  await call('get_webmcp_status');

  // Negative checks: invalid input must be rejected with a clear error
  await call('travel_to_scene', { scene: 'NotAScene' });
  await call('get_agent_state', { agentId: 'agent_missing_999' });

  localStorage.setItem('qa_results', JSON.stringify({
    registered: mc.getTools().map(t => t.name),
    results,
  }));
})();
`;
    const s = document.createElement('script');
    s.textContent = code;
    document.head.appendChild(s);
  });

  // Poll for completion
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(1000);
    const done = await page.evaluate(() => !!localStorage.getItem('qa_results'));
    if (done) break;
  }
  return await page.evaluate(() => JSON.parse(localStorage.getItem('qa_results') || 'null'));
}
