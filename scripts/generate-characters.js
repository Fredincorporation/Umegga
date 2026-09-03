import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Helper to calculate CRC32 for PNG chunks
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createPng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const scanlineOffset = y * (1 + width * 4);
    scanlines[scanlineOffset] = 0; // Filter None
    const rowSourceOffset = y * width * 4;
    rgbaBuffer.copy(scanlines, scanlineOffset + 1, rowSourceOffset, rowSourceOffset + width * 4);
  }

  const compressed = zlib.deflateSync(scanlines);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcTarget = chunk.subarray(4, 8 + len);
  const crcVal = crc32(crcTarget);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

// Pixel drawing canvas simulator
class PixelCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.buffer = Buffer.alloc(width * height * 4); // 0 = transparent black
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    this.buffer[idx] = r;
    this.buffer[idx + 1] = g;
    this.buffer[idx + 2] = b;
    this.buffer[idx + 3] = a;
  }

  fillRect(x, y, w, h, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, py, r, g, b, a);
      }
    }
  }

  fillCircle(cx, cy, radius, r, g, b, a = 255) {
    cx = Math.round(cx);
    cy = Math.round(cy);
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        if (x * x + y * y <= radius * radius) {
          this.setPixel(cx + x, cy + y, r, g, b, a);
        }
      }
    }
  }

  toPng() {
    return createPng(this.width, this.height, this.buffer);
  }
}

// Character definitions with distinct visual styling
const CHARACTERS = {
  aelira: {
    name: 'Aelira',
    title: 'Story Weaver & High Mage',
    skin: [255, 224, 189],
    hair: [56, 189, 248], // Cyan/Starry Blue
    robe: [30, 58, 138], // Deep royal blue
    accent: [245, 158, 11], // Gold
    accessory: 'staff',
    accessoryColor: [56, 189, 248],
  },
  torren: {
    name: 'Torren',
    title: 'High Arbiter of Laws',
    skin: [240, 200, 160],
    hair: [217, 119, 6], // Amber
    robe: [226, 232, 240], // Silver / Gold plate
    accent: [234, 179, 8], // Gold trim
    accessory: 'sword',
    accessoryColor: [241, 245, 249],
  },
  kaelen: {
    name: 'Kaelen',
    title: 'Mythic Blacksmith',
    skin: [220, 175, 140],
    hair: [239, 68, 68], // Fiery Red
    robe: [120, 53, 15], // Brown Leather
    accent: [249, 115, 22], // Forge Ember
    accessory: 'hammer',
    accessoryColor: [148, 163, 184],
  },
  veyra: {
    name: 'Veyra',
    title: 'Shadow Oracle',
    skin: [230, 215, 235],
    hair: [168, 85, 247], // Violet
    robe: [59, 7, 100], // Dark Void Purple
    accent: [216, 180, 254], // Neon Lavender
    accessory: 'orb',
    accessoryColor: [192, 132, 252],
  },
  orthas: {
    name: 'Orthas',
    title: 'Golem Architect',
    skin: [148, 163, 184], // Stone gray
    hair: [71, 85, 105], // Slate
    robe: [30, 41, 59], // Obsidian Armor
    accent: [6, 182, 212], // Cyan Power Rune
    accessory: 'rune',
    accessoryColor: [34, 211, 238],
  },
  sylis: {
    name: 'Sylis',
    title: 'Verdant Botanist',
    skin: [250, 220, 190],
    hair: [34, 197, 94], // Leaf Green
    robe: [20, 83, 45], // Deep Forest Green
    accent: [134, 239, 172], // Spring Green
    accessory: 'staff',
    accessoryColor: [101, 163, 13],
  },
  lira: {
    name: 'Lira',
    title: 'Mythic Bard',
    skin: [255, 228, 200],
    hair: [244, 63, 94], // Rose Pink
    robe: [159, 18, 57], // Crimson Velvet
    accent: [253, 224, 71], // Golden Ribbon
    accessory: 'lute',
    accessoryColor: [180, 83, 9],
  },
  elder_maelon: {
    name: 'Elder Maelon',
    title: 'Arch-Philosopher',
    skin: [245, 210, 180],
    hair: [226, 232, 240], // Silver White
    robe: [67, 20, 7], // Ancient Brown / Crimson
    accent: [251, 191, 36], // Sun Gold
    accessory: 'scroll',
    accessoryColor: [254, 243, 199],
  },
  vance: {
    name: 'Vance',
    title: 'Guildmaster of Trade',
    skin: [235, 195, 165],
    hair: [51, 65, 85], // Charcoal
    robe: [88, 28, 135], // Tyrian Purple
    accent: [234, 179, 8], // Gold Coin belt
    accessory: 'pouch',
    accessoryColor: [245, 158, 11],
  },
};

const WIDTH = 48;
const HEIGHT = 48;

function drawCharacterFrame(charDef, animType, frameIndex, totalFrames) {
  const canvas = new PixelCanvas(WIDTH, HEIGHT);
  const cx = 24;
  let cy = 20;

  // Animation offsets & poses
  let headBob = 0;
  let legLeftOffset = 0;
  let legRightOffset = 0;
  let armSwing = 0;
  let mouthOpen = false;
  let auraGlow = 0;

  if (animType === 'idle') {
    // Gentle floating breathing bob
    headBob = Math.sin((frameIndex / totalFrames) * Math.PI * 2) * 1.5;
    auraGlow = Math.sin((frameIndex / totalFrames) * Math.PI * 2) * 2;
  } else if (animType === 'walk') {
    // Walking leg cycle and arm swinging
    const phase = (frameIndex / totalFrames) * Math.PI * 2;
    headBob = Math.abs(Math.sin(phase)) * 1.8;
    legLeftOffset = Math.sin(phase) * 3;
    legRightOffset = -Math.sin(phase) * 3;
    armSwing = Math.sin(phase) * 4;
  } else if (animType === 'talk') {
    headBob = Math.sin((frameIndex / totalFrames) * Math.PI * 4) * 0.8;
    mouthOpen = frameIndex % 2 === 1;
    armSwing = (frameIndex % 2) * 2;
  }

  const bodyY = cy + Math.round(headBob);

  // 1. Soft Shadow on the ground
  canvas.fillRect(cx - 10, 42, 20, 4, 15, 23, 42, 100);
  canvas.fillRect(cx - 8, 43, 16, 2, 10, 15, 30, 140);

  // 2. Magic Aura / Glow for mythic feel
  if (charDef.accessoryColor) {
    const [ar, ag, ab] = charDef.accessoryColor;
    canvas.fillCircle(cx, bodyY + 4, 16 + auraGlow, ar, ag, ab, 20);
  }

  // 3. Legs / Feet
  const legY = bodyY + 14;
  const leftLegX = cx - 5;
  const rightLegX = cx + 3;

  // Dark boots/pants
  canvas.fillRect(leftLegX, legY + legLeftOffset, 3, 7 - legLeftOffset * 0.5, 30, 41, 59);
  canvas.fillRect(rightLegX, legY + legRightOffset, 3, 7 - legRightOffset * 0.5, 30, 41, 59);

  // Boots tip
  canvas.fillRect(leftLegX - 1, 41 + Math.round(legLeftOffset * 0.5), 4, 2, 15, 23, 42);
  canvas.fillRect(rightLegX - 1, 41 + Math.round(legRightOffset * 0.5), 4, 2, 15, 23, 42);

  // 4. Robe / Tunic (Body)
  const [rr, rg, rb] = charDef.robe;
  const [ar, ag, ab] = charDef.accent;

  // Cloak / Torso
  canvas.fillRect(cx - 7, bodyY + 4, 14, 11, rr, rg, rb);
  // Highlight / Shadow gradient on robe
  canvas.fillRect(cx - 5, bodyY + 4, 10, 10, Math.min(255, rr + 25), Math.min(255, rg + 25), Math.min(255, rb + 25));

  // Belt / Accent
  canvas.fillRect(cx - 7, bodyY + 9, 14, 2, ar, ag, ab);
  canvas.fillRect(cx - 2, bodyY + 8, 4, 4, 255, 255, 255); // Buckle gem

  // Robe trim
  canvas.fillRect(cx - 7, bodyY + 14, 14, 2, ar, ag, ab);

  // 5. Head & Face
  const [sr, sg, sb] = charDef.skin;
  const headX = cx - 5;
  const headY = bodyY - 6;

  // Head base
  canvas.fillRect(headX, headY, 10, 10, sr, sg, sb);
  // Cheeks / shading
  canvas.fillRect(headX + 1, headY + 5, 2, 2, Math.max(0, sr - 30), Math.max(0, sg - 40), Math.max(0, sb - 40));
  canvas.fillRect(headX + 7, headY + 5, 2, 2, Math.max(0, sr - 30), Math.max(0, sg - 40), Math.max(0, sb - 40));

  // Eyes (Deep glowing or expressive)
  canvas.fillRect(headX + 2, headY + 3, 2, 2, 15, 23, 42);
  canvas.fillRect(headX + 6, headY + 3, 2, 2, 15, 23, 42);
  // Eye glint
  canvas.setPixel(headX + 2, headY + 3, 255, 255, 255);
  canvas.setPixel(headX + 6, headY + 3, 255, 255, 255);

  // Mouth
  if (mouthOpen) {
    canvas.fillRect(headX + 4, headY + 7, 2, 2, 190, 50, 50);
  } else {
    canvas.fillRect(headX + 4, headY + 7, 2, 1, 160, 80, 80);
  }

  // 6. Hair & Headwear
  const [hr, hg, hb] = charDef.hair;
  // Hair top
  canvas.fillRect(headX - 1, headY - 3, 12, 4, hr, hg, hb);
  // Hair sides/bangs
  canvas.fillRect(headX - 2, headY - 1, 3, 7, hr, hg, hb);
  canvas.fillRect(headX + 9, headY - 1, 3, 7, hr, hg, hb);
  // Hair crown highlight
  canvas.fillRect(headX + 1, headY - 2, 8, 1, Math.min(255, hr + 45), Math.min(255, hg + 45), Math.min(255, hb + 45));

  // Special hair for elder (beard)
  if (charDef.accessory === 'scroll' || charDef.name.includes('Elder')) {
    canvas.fillRect(headX + 3, headY + 7, 4, 6, hr, hg, hb);
    canvas.fillRect(headX + 4, headY + 13, 2, 2, hr, hg, hb);
  }

  // 7. Arms & Accessories
  // Left arm
  canvas.fillRect(cx - 9, bodyY + 5 - armSwing * 0.5, 3, 7, rr, rg, rb);
  canvas.fillRect(cx - 9, bodyY + 11 - armSwing * 0.5, 3, 2, sr, sg, sb);

  // Right arm / weapon hand
  const rightHandX = cx + 7;
  const rightHandY = bodyY + 6 + armSwing * 0.5;
  canvas.fillRect(cx + 6, bodyY + 5 + armSwing * 0.5, 3, 7, rr, rg, rb);
  canvas.fillRect(rightHandX, rightHandY, 3, 2, sr, sg, sb);

  // Character-specific held accessories
  const [accR, accG, accB] = charDef.accessoryColor || [255, 255, 255];
  if (charDef.accessory === 'staff') {
    // Staff wood pole
    canvas.fillRect(rightHandX + 2, bodyY - 10, 2, 26, 120, 53, 15);
    // Glowing crystal top
    canvas.fillCircle(rightHandX + 3, bodyY - 9, 3, accR, accG, accB);
    canvas.setPixel(rightHandX + 3, bodyY - 9, 255, 255, 255);
  } else if (charDef.accessory === 'sword') {
    // Blade
    canvas.fillRect(rightHandX + 2, bodyY - 6, 2, 16, 226, 232, 240);
    // Crossguard
    canvas.fillRect(rightHandX, bodyY + 5, 6, 2, 234, 179, 8);
    // Pommel
    canvas.fillRect(rightHandX + 2, bodyY + 8, 2, 2, 234, 179, 8);
  } else if (charDef.accessory === 'hammer') {
    // Handle
    canvas.fillRect(rightHandX + 2, bodyY - 2, 2, 14, 120, 53, 15);
    // Heavy head
    canvas.fillRect(rightHandX, bodyY - 6, 6, 5, 148, 163, 184);
  } else if (charDef.accessory === 'orb') {
    // Floating magic orb
    const orbFloat = Math.sin((frameIndex / totalFrames) * Math.PI * 2) * 3;
    canvas.fillCircle(rightHandX + 4, bodyY - 2 + orbFloat, 4, accR, accG, accB, 230);
    canvas.fillCircle(rightHandX + 4, bodyY - 2 + orbFloat, 2, 255, 255, 255);
  } else if (charDef.accessory === 'lute') {
    // Musical lute
    canvas.fillCircle(rightHandX + 2, bodyY + 4, 4, accR, accG, accB);
    canvas.fillRect(rightHandX + 1, bodyY - 5, 2, 8, 90, 40, 10);
  } else if (charDef.accessory === 'scroll') {
    // Ancient glowing scroll
    canvas.fillRect(rightHandX + 1, bodyY + 2, 6, 7, 254, 243, 199);
    canvas.fillRect(rightHandX + 2, bodyY + 4, 4, 1, 120, 53, 15);
    canvas.fillRect(rightHandX + 2, bodyY + 6, 4, 1, 120, 53, 15);
  } else if (charDef.accessory === 'pouch') {
    // Gold pouch
    canvas.fillRect(rightHandX + 1, bodyY + 3, 5, 5, accR, accG, accB);
    canvas.fillRect(rightHandX + 2, bodyY + 2, 3, 1, 255, 255, 255);
  }

  return canvas.toPng();
}

// Generate directory structure and files
const outputBase = path.resolve(process.cwd(), 'public', 'characters');

const ANIMATIONS = [
  { name: 'idle', frameCount: 6 },
  { name: 'walk', frameCount: 6 },
  { name: 'talk', frameCount: 4 },
];

console.log('Generating characters in:', outputBase);

for (const [key, charDef] of Object.entries(CHARACTERS)) {
  for (const anim of ANIMATIONS) {
    const dirPath = path.join(outputBase, key, anim.name);
    fs.mkdirSync(dirPath, { recursive: true });

    for (let f = 1; f <= anim.frameCount; f++) {
      const fileName = `auto-${String(f).padStart(3, '0')}.png`;
      const filePath = path.join(dirPath, fileName);
      const pngBuffer = drawCharacterFrame(charDef, anim.name, f - 1, anim.frameCount);
      fs.writeFileSync(filePath, pngBuffer);
    }
  }
}

// Also generate a rich tileset and prop textures for Phaser map rendering
const mapDir = path.resolve(process.cwd(), 'public', 'tiles');
fs.mkdirSync(mapDir, { recursive: true });

// Cobblestone ground tile (32x32)
const groundCanvas = new PixelCanvas(32, 32);
groundCanvas.fillRect(0, 0, 32, 32, 30, 41, 59); // Slate-800
for (let y = 0; y < 32; y += 8) {
  for (let x = 0; x < 32; x += 8) {
    const offset = (y / 8) % 2 === 0 ? 0 : 4;
    const px = (x + offset) % 32;
    groundCanvas.fillRect(px, y, 7, 7, 51, 65, 85); // Slate-700
    groundCanvas.setPixel(px + 1, y + 1, 71, 85, 105); // Highlight
  }
}
fs.writeFileSync(path.join(mapDir, 'cobble.png'), groundCanvas.toPng());

// Grass tile (32x32)
const grassCanvas = new PixelCanvas(32, 32);
grassCanvas.fillRect(0, 0, 32, 32, 22, 101, 52); // Forest green
for (let i = 0; i < 40; i++) {
  const gx = (i * 7) % 32;
  const gy = (i * 13) % 32;
  grassCanvas.setPixel(gx, gy, 34, 197, 94);
  grassCanvas.setPixel(gx, gy + 1, 21, 128, 61);
}
fs.writeFileSync(path.join(mapDir, 'grass.png'), grassCanvas.toPng());

// Water / Aether tile (32x32)
const waterCanvas = new PixelCanvas(32, 32);
waterCanvas.fillRect(0, 0, 32, 32, 12, 74, 110);
for (let i = 0; i < 20; i++) {
  const wx = (i * 9) % 32;
  const wy = (i * 11) % 32;
  waterCanvas.fillRect(wx, wy, 4, 1, 56, 189, 248);
}
fs.writeFileSync(path.join(mapDir, 'water.png'), waterCanvas.toPng());

// Mythic Monument / Prop (64x64)
const propCanvas = new PixelCanvas(64, 64);
// Stone pedestal
propCanvas.fillRect(16, 44, 32, 16, 30, 41, 59);
propCanvas.fillRect(12, 56, 40, 8, 15, 23, 42);
// Runic pillar
propCanvas.fillRect(22, 18, 20, 28, 71, 85, 105);
// Floating Crystal
propCanvas.fillCircle(32, 14, 10, 168, 85, 247, 220);
propCanvas.fillCircle(32, 14, 6, 216, 180, 254, 255);
propCanvas.fillCircle(32, 14, 2, 255, 255, 255, 255);
fs.writeFileSync(path.join(mapDir, 'monument.png'), propCanvas.toPng());

console.log('✅ All character animations and map tiles successfully generated!');
