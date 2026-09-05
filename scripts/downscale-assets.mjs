// Downscale buildings/props to max 512px with sharp (alpha-preserving).
// Run: node scripts/downscale-assets.mjs
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

for (const dir of ['buildings', 'props']) {
  const d = join(process.cwd(), 'public', dir);
  for (const f of readdirSync(d).filter((f) => f.endsWith('.png'))) {
    const p = join(d, f);
    const m = await sharp(p).metadata();
    if (m.width <= 512 && m.height <= 512) continue;
    const buf = await sharp(p).resize({ width: 512, height: 512, fit: 'inside' }).png().toBuffer();
    await sharp(buf).toFile(p);
    console.log(`${dir}/${f}: ${m.width}x${m.height} -> done`);
  }
}
console.log('Done.');
