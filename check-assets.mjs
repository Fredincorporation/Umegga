// Check dimensions of key assets on the CDN to estimate GPU texture memory
import sharp from 'sharp';

const BASE = 'https://umega-assets.pages.dev';
const paths = [
  '/environment/sanctuary_bg.png',
  '/environment/oracle_basin_bg.png',
  '/environment/botanist_grove_bg.png',
  '/environment/grand_forge_bg.png',
  '/environment/bards_amphitheatre_bg.png',
  '/environment/fraying_march_bg.png',
  '/environment/outer.png',
  '/loading-screen.png',
  '/characters/aelira/idle/auto-001.png',
  '/characters/torren/idle/00_torren_idle.png',
  '/buildings/story_spire.png',
  '/buildings/council_hall.png',
  '/buildings/magma_furnace.png',
  '/tiles/cobble.png',
];

let totalMB = 0;
for (const p of paths) {
  try {
    const res = await fetch(BASE + p);
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    const vramMB = +((meta.width * meta.height * 4) / 1048576).toFixed(1);
    totalMB += vramMB;
    console.log(`${p}  ${meta.width}x${meta.height}  ${(buf.length/1024).toFixed(0)}KB file  ${vramMB}MB VRAM`);
  } catch (e) {
    console.log(`${p}  ERROR ${e.message}`);
  }
}
console.log(`\nTotal for sampled assets: ${totalMB.toFixed(1)}MB VRAM`);
