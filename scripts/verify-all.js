import http from 'node:http';

function testUrl(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let len = 0;
      res.on('data', chunk => len += chunk.length);
      res.on('end', () => {
        resolve({ path, status: res.statusCode, length: len });
      });
    }).on('error', (err) => {
      resolve({ path, status: 0, error: err.message });
    });
  });
}

async function main() {
  console.log('=== VERIFYING UMEGA SERVER & ASSETS ===');

  const rootRes = await testUrl('/');
  console.log(`Root / status: ${rootRes.status} (bytes: ${rootRes.length})`);

  const assetsToTest = [
    // Environments
    '/environment/sanctuary_bg.png',
    '/environment/oracle_basin_bg.png',
    '/environment/botanist_grove_bg.png',
    '/environment/grand_forge_bg.png',
    '/environment/bards_amphitheatre_bg.png',
    '/environment/fraying_march_bg.png',
    // Tiles
    '/environment/sanctuary_cobble.png',
    '/environment/oracle_cobble.png',
    '/environment/grove_cobble.png',
    '/environment/forge_cobble.png',
    '/environment/amphitheatre_cobble.png',
    '/environment/march_cobble.png',
    // Buildings
    '/buildings/sanctuary_temple.png',
    '/buildings/council_hall.png',
    '/buildings/oracle_observatory.png',
    '/buildings/scrying_tower.png',
    '/buildings/grove_conservatory.png',
    '/buildings/grand_forge_foundry.png',
    '/buildings/amphitheatre_stage.png',
    '/buildings/rift_beacon.png',
    // Props
    '/props/portal_gate_cyan.png',
    '/props/portal_gate_purple.png',
    '/props/portal_gate_green.png',
    '/props/portal_gate_orange.png',
    '/props/portal_gate_rose.png',
    '/props/portal_gate_teal.png',
    '/props/arcane_fountain.png',
    '/props/tree_willow.png',
    '/props/tree_crystal.png',
    '/props/forge_anvil.png',
    '/props/rune_stone.png',
    // Characters
    '/characters/aelira/idle/auto-001.png',
    '/characters/elder_maelon/idle/auto-001.png',
    '/characters/kealen/idle/00_kealen_idle.png',
    '/characters/lira/idle/auto-001.png',
    '/characters/orthas/idle/00_orthas_idle.png',
    '/characters/sylis/idle/00_sylis_idle.png',
    '/characters/torren/idle/00_torren_idle.png',
    '/characters/vance/idle/00_vance_idle.png',
    '/characters/veyra/idle/00_veyra_idle.png',
  ];

  let passed = 0;
  let failed = 0;

  for (const assetPath of assetsToTest) {
    const res = await testUrl(assetPath);
    if (res.status === 200 && res.length > 0) {
      passed++;
    } else {
      failed++;
      console.error(`FAILED: ${assetPath} => status ${res.status}`);
    }
  }

  console.log(`Asset Verification Result: ${passed} PASSED, ${failed} FAILED`);
  if (failed === 0) {
    console.log('>>> All world environments, buildings, props, character frames, and HTTP endpoints are 100% operational! <<<');
  }
}

main();
