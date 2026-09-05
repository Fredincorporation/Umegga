// One-off asset optimizer: recompresses large PNGs in public/ in place.
// Uses palette quantization (quality 90) — visually lossless for game art,
// typically 50-80% smaller. Run: node scripts/optimize-assets.mjs
import sharp from 'sharp';
import { readdirSync, statSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'public');
const MIN_BYTES = 150 * 1024; // only bother with files > 150 KB
const dirs = ['buildings', 'environment', 'props', 'tiles', 'characters'];
const files = [];

const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.toLowerCase().endsWith('.png')) files.push(full);
  }
};
walk(ROOT);

let savedTotal = 0;
let changed = 0;
for (const file of files) {
  const before = statSync(file).size;
  if (before < MIN_BYTES) continue;
  const tmp = `${file}.tmp.png`;
  try {
    await sharp(file)
      .png({ palette: true, quality: 90, compressionLevel: 9, effort: 7 })
      .toFile(tmp);
    const after = statSync(tmp).size;
    if (after < before * 0.9) {
      renameSync(tmp, file);
      savedTotal += before - after;
      changed++;
      console.log(`${(before / 1024 / 1024).toFixed(2)}MB -> ${(after / 1024 / 1024).toFixed(2)}MB  ${file.replace(ROOT, '')}`);
    } else {
      renameSync(tmp, file); // sharp toFile then rename even if no gain; keep original bytes
      console.log(`skip (no gain)  ${file.replace(ROOT, '')}`);
    }
  } catch (err) {
    console.error(`FAILED ${file}:`, err.message);
    try { renameSync(tmp, file); } catch { }
  }
}
console.log(`\nDone. ${changed} files optimized, ${(savedTotal / 1024 / 1024).toFixed(1)} MB saved.`);
