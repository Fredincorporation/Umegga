// Normalize character frames onto a uniform canvas so the in-game
// min(76/w, 96/h) scale produces consistent on-screen sizes.
// - trims transparent padding
// - scales content so its height = TARGET_H
// - anchors bottom-center on a square CANVAS
// Run: node scripts/normalize-characters.mjs
import sharp from 'sharp';
import { readdirSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'public', 'characters');
const CANVAS = 256;
const TARGET_H = 160; // content height after scaling

for (const char of readdirSync(ROOT)) {
  for (const anim of readdirSync(join(ROOT, char))) {
    const dir = join(ROOT, char, anim);
    let frames;
    try { frames = readdirSync(dir).filter((f) => f.endsWith('.png')); } catch { continue; }
    if (!frames.length) continue;
    const tmp = dir + '_tmp';
    mkdirSync(tmp, { recursive: true });
    for (const f of frames) {
      const trimmed = await sharp(join(dir, f)).trim().toBuffer();
      const meta = await sharp(trimmed).metadata();
      const scale = Math.min(TARGET_H / meta.height, (CANVAS - 8) / meta.width);
      const w = Math.round(meta.width * scale);
      const h = Math.round(meta.height * scale);
      const resized = await sharp(trimmed).resize(w, h).png().toBuffer();
      await sharp({
        create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: resized, left: Math.round((CANVAS - w) / 2), top: CANVAS - h }])
        .png()
        .toFile(join(tmp, f));
    }
    rmSync(dir, { recursive: true, force: true });
    renameSync(tmp, dir);
    console.log(`normalized ${char}/${anim}: ${frames.length} frames -> ${CANVAS}x${CANVAS}, content h=${TARGET_H}`);
  }
}
console.log('Done.');
