import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRC Table
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

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crcVal = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

function createPng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(6, 9);
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const scanlineOffset = y * (1 + width * 4);
    scanlines[scanlineOffset] = 0;
    const rowSourceOffset = y * width * 4;
    rgbaBuffer.copy(scanlines, scanlineOffset + 1, rowSourceOffset, rowSourceOffset + width * 4);
  }

  const compressed = zlib.deflateSync(scanlines);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

class PixelCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.buffer = Buffer.alloc(width * height * 4);
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    if (a < 255 && this.buffer[idx + 3] > 0) {
      // Alpha blending
      const bgA = this.buffer[idx + 3] / 255;
      const fgA = a / 255;
      const outA = fgA + bgA * (1 - fgA);
      this.buffer[idx] = Math.round((r * fgA + this.buffer[idx] * bgA * (1 - fgA)) / outA);
      this.buffer[idx + 1] = Math.round((g * fgA + this.buffer[idx + 1] * bgA * (1 - fgA)) / outA);
      this.buffer[idx + 2] = Math.round((b * fgA + this.buffer[idx + 2] * bgA * (1 - fgA)) / outA);
      this.buffer[idx + 3] = Math.round(outA * 255);
    } else {
      this.buffer[idx] = r;
      this.buffer[idx + 1] = g;
      this.buffer[idx + 2] = b;
      this.buffer[idx + 3] = a;
    }
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

  strokeRect(x, y, w, h, r, g, b, a = 255) {
    this.fillRect(x, y, w, 1, r, g, b, a);
    this.fillRect(x, y + h - 1, w, 1, r, g, b, a);
    this.fillRect(x, y, 1, h, r, g, b, a);
    this.fillRect(x + w - 1, y, 1, h, r, g, b, a);
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

  fillEllipse(cx, cy, rx, ry, r, g, b, a = 255) {
    cx = Math.round(cx);
    cy = Math.round(cy);
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
          this.setPixel(cx + x, cy + y, r, g, b, a);
        }
      }
    }
  }

  fillPolygon(points, r, g, b, a = 255) {
    // Scanline polygon fill
    let minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const nodeX = [];
      let j = points.length - 1;
      for (let i = 0; i < points.length; i++) {
        if ((points[i].y < y && points[j].y >= y) || (points[j].y < y && points[i].y >= y)) {
          nodeX.push(points[i].x + (y - points[i].y) / (points[j].y - points[i].y) * (points[j].x - points[i].x));
        }
        j = i;
      }
      nodeX.sort((v1, v2) => v1 - v2);
      for (let i = 0; i < nodeX.length; i += 2) {
        if (nodeX[i] >= this.width) break;
        if (nodeX[i + 1] > 0) {
          const start = Math.max(0, Math.round(nodeX[i]));
          const end = Math.min(this.width - 1, Math.round(nodeX[i + 1]));
          for (let x = start; x <= end; x++) {
            this.setPixel(x, y, r, g, b, a);
          }
        }
      }
    }
  }

  toPng() {
    return createPng(this.width, this.height, this.buffer);
  }
}

export { PixelCanvas };

const publicDir = path.resolve(__dirname, '../public');
const envDir = path.join(publicDir, 'environment');
const buildingsDir = path.join(publicDir, 'buildings');
const propsDir = path.join(publicDir, 'props');

[envDir, buildingsDir, propsDir].forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

function savePng(dir, filename, canvas) {
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, canvas.toPng());
  console.log(`Saved: ${path.relative(publicDir, filepath)}`);
}

// ----------------------------------------------------------------------------
// 1. GENERATE ENVIRONMENT TILES & BACKGROUNDS
// ----------------------------------------------------------------------------

function generateEnvironments() {
  const envConfigs = [
    {
      id: 'sanctuary',
      bgName: 'sanctuary_bg.png',
      cobbleName: 'sanctuary_cobble.png',
      grassName: 'sanctuary_grass.png',
      waterName: 'sanctuary_water.png',
      baseGrass: [15, 23, 42],      // deep midnight slate
      grassHighlight: [56, 189, 248], // cyan glow
      cobbleBase: [30, 41, 59],      // slate blue
      cobbleMortar: [15, 23, 42],
      waterBase: [14, 165, 233],     // glowing cyan
    },
    {
      id: 'oracle',
      bgName: 'oracle_basin_bg.png',
      cobbleName: 'oracle_cobble.png',
      grassName: 'oracle_grass.png',
      waterName: 'oracle_water.png',
      baseGrass: [26, 16, 48],      // deep astral purple
      grassHighlight: [192, 132, 252], // amethyst glow
      cobbleBase: [46, 26, 71],
      cobbleMortar: [17, 10, 31],
      waterBase: [168, 85, 247],     // void purple
    },
    {
      id: 'grove',
      bgName: 'botanist_grove_bg.png',
      cobbleName: 'grove_cobble.png',
      grassName: 'grove_grass.png',
      waterName: 'grove_water.png',
      baseGrass: [6, 44, 28],       // deep verdant emerald
      grassHighlight: [74, 222, 128], // neon jade bloom
      cobbleBase: [20, 83, 45],
      cobbleMortar: [6, 44, 28],
      waterBase: [16, 185, 129],     // emerald spring
    },
    {
      id: 'forge',
      bgName: 'grand_forge_bg.png',
      cobbleName: 'forge_cobble.png',
      grassName: 'forge_grass.png',
      waterName: 'forge_water.png',
      baseGrass: [35, 18, 12],      // molten rock / obsidian
      grassHighlight: [251, 146, 60], // orange ember
      cobbleBase: [67, 30, 20],
      cobbleMortar: [25, 12, 8],
      waterBase: [239, 68, 68],      // glowing liquid magma
    },
    {
      id: 'amphitheatre',
      bgName: 'bards_amphitheatre_bg.png',
      cobbleName: 'amphitheatre_cobble.png',
      grassName: 'amphitheatre_grass.png',
      waterName: 'amphitheatre_water.png',
      baseGrass: [40, 15, 28],      // rose velvet slate
      grassHighlight: [251, 113, 133], // rose pink light
      cobbleBase: [76, 29, 46],
      cobbleMortar: [30, 10, 20],
      waterBase: [244, 63, 94],      // radiant rose fountain
    },
    {
      id: 'march',
      bgName: 'fraying_march_bg.png',
      cobbleName: 'march_cobble.png',
      grassName: 'march_grass.png',
      waterName: 'march_water.png',
      baseGrass: [15, 23, 42],      // void fracture dark
      grassHighlight: [45, 212, 191], // turquoise rift cracks
      cobbleBase: [24, 38, 54],
      cobbleMortar: [10, 15, 25],
      waterBase: [20, 184, 166],     // rift essence
    },
  ];

  envConfigs.forEach((cfg) => {
    // 1. Large 128x128 District Background pattern
    const bg = new PixelCanvas(128, 128);
    bg.fillRect(0, 0, 128, 128, cfg.baseGrass[0], cfg.baseGrass[1], cfg.baseGrass[2], 255);
    // Add grid lines and decorative stars/nodes
    for (let y = 0; y < 128; y += 16) {
      for (let x = 0; x < 128; x += 16) {
        bg.strokeRect(x, y, 16, 16, cfg.cobbleMortar[0], cfg.cobbleMortar[1], cfg.cobbleMortar[2], 120);
        if ((x + y) % 32 === 0) {
          bg.fillCircle(x + 8, y + 8, 2, cfg.grassHighlight[0], cfg.grassHighlight[1], cfg.grassHighlight[2], 180);
        }
      }
    }
    savePng(envDir, cfg.bgName, bg);

    // 2. 32x32 Cobblestone Tile
    const cobble = new PixelCanvas(32, 32);
    cobble.fillRect(0, 0, 32, 32, cfg.cobbleMortar[0], cfg.cobbleMortar[1], cfg.cobbleMortar[2], 255);
    const stones = [
      { x: 1, y: 1, w: 14, h: 14 },
      { x: 17, y: 1, w: 14, h: 14 },
      { x: 1, y: 17, w: 14, h: 14 },
      { x: 17, y: 17, w: 14, h: 14 },
    ];
    stones.forEach((s) => {
      cobble.fillRect(s.x, s.y, s.w, s.h, cfg.cobbleBase[0], cfg.cobbleBase[1], cfg.cobbleBase[2], 255);
      cobble.fillRect(s.x, s.y, s.w, 1, cfg.cobbleBase[0] + 30, cfg.cobbleBase[1] + 30, cfg.cobbleBase[2] + 30, 255);
      cobble.fillRect(s.x + 2, s.y + 2, 2, 2, cfg.grassHighlight[0], cfg.grassHighlight[1], cfg.grassHighlight[2], 120);
    });
    savePng(envDir, cfg.cobbleName, cobble);

    // 3. 32x32 Grass / Ground Tile
    const grass = new PixelCanvas(32, 32);
    grass.fillRect(0, 0, 32, 32, cfg.baseGrass[0], cfg.baseGrass[1], cfg.baseGrass[2], 255);
    for (let i = 0; i < 8; i++) {
      const gx = (i * 7) % 28 + 2;
      const gy = (i * 11) % 28 + 2;
      grass.fillRect(gx, gy, 2, 3, cfg.grassHighlight[0], cfg.grassHighlight[1], cfg.grassHighlight[2], 220);
      grass.fillRect(gx + 1, gy - 1, 1, 2, cfg.grassHighlight[0], cfg.grassHighlight[1], cfg.grassHighlight[2], 160);
    }
    savePng(envDir, cfg.grassName, grass);

    // 4. 32x32 Water / Fluid Tile
    const water = new PixelCanvas(32, 32);
    water.fillRect(0, 0, 32, 32, cfg.waterBase[0], cfg.waterBase[1], cfg.waterBase[2], 210);
    // Animated wave highlights
    water.fillRect(2, 6, 12, 2, 255, 255, 255, 140);
    water.fillRect(18, 14, 10, 2, 255, 255, 255, 140);
    water.fillRect(6, 22, 14, 2, 255, 255, 255, 140);
    savePng(envDir, cfg.waterName, water);
  });
}

// ----------------------------------------------------------------------------
// 2. GENERATE BUILDINGS FOR 6 DISTRICTS
// ----------------------------------------------------------------------------

function drawBuilding(w, h, primary, secondary, accent, trim, roofType = 'dome') {
  const c = new PixelCanvas(w, h);

  // Base shadow
  c.fillEllipse(w / 2, h - 8, w / 2 - 4, 8, 0, 0, 0, 110);

  // Main walls
  const wallTop = Math.floor(h * 0.35);
  const wallBottom = h - 14;
  const wallLeft = 8;
  const wallRight = w - 8;
  const wallW = wallRight - wallLeft;
  const wallH = wallBottom - wallTop;

  c.fillRect(wallLeft, wallTop, wallW, wallH, primary[0], primary[1], primary[2], 255);
  // Shading / texture on walls
  for (let y = wallTop; y < wallBottom; y += 8) {
    c.fillRect(wallLeft, y, wallW, 1, primary[0] - 20, primary[1] - 20, primary[2] - 20, 150);
  }

  // Pillars / Trim on walls
  c.fillRect(wallLeft + 4, wallTop, 6, wallH, secondary[0], secondary[1], secondary[2], 255);
  c.fillRect(wallRight - 10, wallTop, 6, wallH, secondary[0], secondary[1], secondary[2], 255);
  c.fillRect(w / 2 - 3, wallTop, 6, wallH, secondary[0], secondary[1], secondary[2], 255);

  // Doorway
  const doorW = Math.min(24, Math.floor(w * 0.28));
  const doorH = Math.min(32, Math.floor(wallH * 0.65));
  const doorX = Math.floor(w / 2 - doorW / 2);
  const doorY = wallBottom - doorH;

  c.fillRect(doorX, doorY, doorW, doorH, 15, 23, 42, 255);
  c.strokeRect(doorX - 2, doorY - 2, doorW + 4, doorH + 2, trim[0], trim[1], trim[2], 255);
  // Glowing rune inside doorway
  c.fillCircle(w / 2, doorY + doorH / 2, 4, accent[0], accent[1], accent[2], 230);

  // Windows
  const winY = wallTop + 8;
  if (wallW > 48) {
    const winLeftX = wallLeft + 14;
    const winRightX = wallRight - 22;
    c.fillRect(winLeftX, winY, 8, 12, accent[0], accent[1], accent[2], 200);
    c.strokeRect(winLeftX, winY, 8, 12, trim[0], trim[1], trim[2], 255);
    c.fillRect(winRightX, winY, 8, 12, accent[0], accent[1], accent[2], 200);
    c.strokeRect(winRightX, winY, 8, 12, trim[0], trim[1], trim[2], 255);
  }

  // Roof
  if (roofType === 'spire') {
    // Tall triangular spire
    const tipX = w / 2;
    const tipY = 6;
    c.fillPolygon([
      { x: tipX, y: tipY },
      { x: wallLeft - 2, y: wallTop },
      { x: wallRight + 2, y: wallTop }
    ], secondary[0], secondary[1], secondary[2], 255);

    // Glowing spire finial
    c.fillCircle(tipX, tipY, 4, accent[0], accent[1], accent[2], 255);
    c.fillCircle(tipX, tipY, 7, accent[0], accent[1], accent[2], 120);
  } else if (roofType === 'dome') {
    // Majestic rounded dome
    const domeRadius = Math.floor(wallW / 2 + 2);
    c.fillCircle(w / 2, wallTop, domeRadius, secondary[0], secondary[1], secondary[2], 255);
    // Cut bottom half of dome so it fits on wall
    c.fillRect(0, wallTop, w, wallH + 10, primary[0], primary[1], primary[2], 0); // clear if any bleed
    // Redraw wall upper trim
    c.fillRect(wallLeft - 4, wallTop - 2, wallW + 8, 4, trim[0], trim[1], trim[2], 255);
    // Glowing crest on dome
    c.fillCircle(w / 2, wallTop - domeRadius / 2, 5, accent[0], accent[1], accent[2], 240);
  } else if (roofType === 'peaked') {
    // Classical pitched temple roof
    c.fillPolygon([
      { x: w / 2, y: 12 },
      { x: wallLeft - 6, y: wallTop },
      { x: wallRight + 6, y: wallTop }
    ], secondary[0], secondary[1], secondary[2], 255);
    c.fillRect(wallLeft - 8, wallTop - 2, wallW + 16, 4, trim[0], trim[1], trim[2], 255);
    c.fillCircle(w / 2, 24, 6, accent[0], accent[1], accent[2], 240);
  } else if (roofType === 'fortress') {
    // Battlement crenellations
    c.fillRect(wallLeft - 4, wallTop - 6, wallW + 8, 8, secondary[0], secondary[1], secondary[2], 255);
    for (let bx = wallLeft - 4; bx < wallRight + 4; bx += 10) {
      c.fillRect(bx, wallTop - 12, 6, 6, trim[0], trim[1], trim[2], 255);
    }
  }

  return c;
}

function generateBuildings() {
  const buildingList = [
    // Sanctuary
    { name: 'sanctuary_temple.png', w: 96, h: 112, prim: [30, 41, 59], sec: [56, 189, 248], acc: [125, 211, 252], trim: [234, 179, 8], roof: 'dome' },
    { name: 'council_hall.png', w: 88, h: 80, prim: [40, 50, 70], sec: [14, 165, 233], acc: [250, 204, 21], trim: [203, 213, 225], roof: 'peaked' },
    { name: 'aether_spire.png', w: 56, h: 112, prim: [15, 23, 42], sec: [30, 58, 138], acc: [56, 189, 248], trim: [147, 197, 253], roof: 'spire' },
    { name: 'chronicle_vault.png', w: 80, h: 72, prim: [30, 41, 59], sec: [71, 85, 105], acc: [56, 189, 248], trim: [234, 179, 8], roof: 'fortress' },

    // Oracle Basin
    { name: 'oracle_observatory.png', w: 96, h: 96, prim: [46, 26, 71], sec: [147, 51, 234], acc: [216, 180, 254], trim: [192, 132, 252], roof: 'dome' },
    { name: 'scrying_tower.png', w: 56, h: 112, prim: [26, 16, 48], sec: [107, 33, 168], acc: [192, 132, 252], trim: [232, 121, 249], roof: 'spire' },
    { name: 'void_shrine.png', w: 72, h: 80, prim: [35, 20, 60], sec: [88, 28, 135], acc: [168, 85, 247], trim: [216, 180, 254], roof: 'peaked' },
    { name: 'astral_sanctum.png', w: 88, h: 88, prim: [46, 26, 71], sec: [126, 34, 206], acc: [192, 132, 252], trim: [250, 204, 21], roof: 'dome' },

    // Botanist Grove
    { name: 'grove_conservatory.png', w: 96, h: 96, prim: [6, 78, 59], sec: [16, 185, 129], acc: [74, 222, 128], trim: [167, 243, 208], roof: 'dome' },
    { name: 'world_root_nursery.png', w: 88, h: 88, prim: [20, 83, 45], sec: [5, 150, 105], acc: [52, 211, 153], trim: [251, 191, 36], roof: 'peaked' },
    { name: 'herbarium.png', w: 72, h: 72, prim: [6, 78, 59], sec: [4, 120, 87], acc: [110, 231, 183], trim: [209, 250, 229], roof: 'fortress' },
    { name: 'biomancer_lab.png', w: 72, h: 96, prim: [2, 44, 34], sec: [16, 185, 129], acc: [52, 211, 153], trim: [134, 239, 172], roof: 'spire' },

    // Grand Forge
    { name: 'grand_forge_foundry.png', w: 96, h: 112, prim: [67, 30, 20], sec: [234, 88, 12], acc: [251, 146, 60], trim: [253, 186, 116], roof: 'fortress' },
    { name: 'magma_furnace.png', w: 88, h: 88, prim: [80, 35, 20], sec: [194, 65, 12], acc: [239, 68, 68], trim: [252, 211, 77], roof: 'dome' },
    { name: 'anvil_keep.png', w: 80, h: 80, prim: [55, 25, 18], sec: [154, 52, 18], acc: [249, 115, 22], trim: [229, 231, 235], roof: 'peaked' },
    { name: 'star_smelter.png', w: 72, h: 88, prim: [40, 20, 15], sec: [234, 88, 12], acc: [251, 191, 36], trim: [249, 115, 22], roof: 'spire' },

    // Bards Amphitheatre
    { name: 'amphitheatre_stage.png', w: 112, h: 88, prim: [76, 29, 46], sec: [225, 29, 72], acc: [251, 113, 133], trim: [253, 226, 236], roof: 'dome' },
    { name: 'melody_rotunda.png', w: 88, h: 88, prim: [90, 35, 55], sec: [190, 18, 60], acc: [244, 63, 94], trim: [254, 205, 211], roof: 'peaked' },
    { name: 'bard_academy.png', w: 88, h: 80, prim: [65, 25, 40], sec: [225, 29, 72], acc: [251, 113, 133], trim: [251, 191, 36], roof: 'fortress' },
    { name: 'echo_pavilion.png', w: 72, h: 72, prim: [80, 30, 50], sec: [159, 18, 57], acc: [253, 164, 175], trim: [254, 242, 242], roof: 'spire' },

    // Fraying March
    { name: 'rift_beacon.png', w: 56, h: 112, prim: [15, 23, 42], sec: [13, 148, 136], acc: [45, 212, 191], trim: [153, 246, 228], roof: 'spire' },
    { name: 'frayed_bastion.png', w: 96, h: 96, prim: [24, 38, 54], sec: [15, 118, 110], acc: [20, 184, 166], trim: [94, 234, 212], roof: 'fortress' },
    { name: 'planar_gatehouse.png', w: 88, h: 88, prim: [30, 48, 68], sec: [17, 94, 89], acc: [45, 212, 191], trim: [250, 204, 21], roof: 'peaked' },
    { name: 'void_outpost.png', w: 72, h: 72, prim: [18, 30, 44], sec: [13, 148, 136], acc: [20, 184, 166], trim: [204, 251, 241], roof: 'dome' },
  ];

  buildingList.forEach((b) => {
    const canvas = drawBuilding(b.w, b.h, b.prim, b.sec, b.acc, b.trim, b.roof);
    savePng(buildingsDir, b.name, canvas);
  });
}

// ----------------------------------------------------------------------------
// 3. GENERATE PROPS & PORTAL GATES
// ----------------------------------------------------------------------------

function generateProps() {
  // 1. Portal Gate (Archway with glowing swirling vortex)
  const portalColors = [
    { name: 'portal_gate_cyan.png', vortex: [56, 189, 248], frame: [30, 41, 59] },
    { name: 'portal_gate_purple.png', vortex: [192, 132, 252], frame: [46, 26, 71] },
    { name: 'portal_gate_green.png', vortex: [74, 222, 128], frame: [6, 78, 59] },
    { name: 'portal_gate_orange.png', vortex: [251, 146, 60], frame: [67, 30, 20] },
    { name: 'portal_gate_rose.png', vortex: [251, 113, 133], frame: [76, 29, 46] },
    { name: 'portal_gate_teal.png', vortex: [45, 212, 191], frame: [15, 23, 42] },
  ];

  portalColors.forEach((p) => {
    const c = new PixelCanvas(48, 64);
    // Base shadow
    c.fillEllipse(24, 58, 20, 6, 0, 0, 0, 120);
    // Outer Stone Pillars
    c.fillRect(6, 16, 8, 44, p.frame[0], p.frame[1], p.frame[2], 255);
    c.fillRect(34, 16, 8, 44, p.frame[0], p.frame[1], p.frame[2], 255);
    // Arch Top
    c.fillRect(6, 10, 36, 8, p.frame[0] + 15, p.frame[1] + 15, p.frame[2] + 15, 255);
    c.fillCircle(24, 10, 6, 250, 204, 21, 255); // gold keystone

    // Swirling Energy Vortex
    c.fillEllipse(24, 36, 11, 20, p.vortex[0], p.vortex[1], p.vortex[2], 220);
    c.fillEllipse(24, 36, 7, 14, 255, 255, 255, 200);
    c.fillCircle(24, 36, 4, p.vortex[0], p.vortex[1], p.vortex[2], 255);

    savePng(propsDir, p.name, c);
  });

  // 2. Street Lamp / Arcane Brazier
  const lamp = new PixelCanvas(24, 48);
  lamp.fillEllipse(12, 44, 8, 4, 0, 0, 0, 100);
  lamp.fillRect(10, 20, 4, 24, 30, 41, 59, 255);
  lamp.fillRect(8, 40, 8, 4, 51, 65, 85, 255);
  // Lantern head
  lamp.fillRect(6, 10, 12, 10, 15, 23, 42, 255);
  lamp.fillRect(8, 12, 8, 6, 250, 204, 21, 240); // gold glow
  lamp.fillCircle(12, 15, 6, 253, 224, 71, 140); // outer glow
  savePng(propsDir, 'street_lamp.png', lamp);

  // 3. Tree / Flora Types
  // Verdant Willow Tree
  const treeWillow = new PixelCanvas(48, 64);
  treeWillow.fillEllipse(24, 58, 18, 6, 0, 0, 0, 100);
  treeWillow.fillRect(20, 32, 8, 28, 69, 26, 3, 255); // Trunk
  treeWillow.fillCircle(24, 24, 20, 22, 101, 52, 255); // Foliage
  treeWillow.fillCircle(24, 20, 15, 34, 197, 94, 255);
  treeWillow.fillCircle(24, 16, 9, 134, 239, 172, 200);
  savePng(propsDir, 'tree_willow.png', treeWillow);

  // Crystal Tree
  const treeCrystal = new PixelCanvas(48, 64);
  treeCrystal.fillEllipse(24, 58, 18, 6, 0, 0, 0, 100);
  treeCrystal.fillRect(21, 32, 6, 28, 30, 41, 59, 255);
  treeCrystal.fillPolygon([
    { x: 24, y: 6 },
    { x: 6, y: 44 },
    { x: 42, y: 44 }
  ], 56, 189, 248, 240);
  treeCrystal.fillPolygon([
    { x: 24, y: 14 },
    { x: 12, y: 38 },
    { x: 36, y: 38 }
  ], 186, 230, 253, 220);
  savePng(propsDir, 'tree_crystal.png', treeCrystal);

  // 4. Arcane Well / Fountain
  const fountain = new PixelCanvas(48, 48);
  fountain.fillEllipse(24, 40, 20, 8, 0, 0, 0, 120);
  fountain.fillCircle(24, 26, 18, 51, 65, 85, 255);
  fountain.fillCircle(24, 26, 14, 14, 165, 233, 255);
  fountain.fillCircle(24, 26, 8, 255, 255, 255, 220);
  savePng(propsDir, 'arcane_fountain.png', fountain);

  // 5. Rune Stone / Monolith
  const runeStone = new PixelCanvas(32, 48);
  runeStone.fillEllipse(16, 44, 12, 4, 0, 0, 0, 110);
  runeStone.fillPolygon([
    { x: 16, y: 4 },
    { x: 6, y: 42 },
    { x: 26, y: 42 }
  ], 71, 85, 105, 255);
  // Inscribed rune
  runeStone.fillRect(15, 14, 2, 18, 192, 132, 252, 255);
  runeStone.fillRect(11, 20, 10, 2, 192, 132, 252, 255);
  runeStone.fillRect(11, 28, 10, 2, 192, 132, 252, 255);
  savePng(propsDir, 'rune_stone.png', runeStone);

  // 6. Planar Anvil / Smithing Stand
  const anvil = new PixelCanvas(36, 32);
  anvil.fillEllipse(18, 28, 14, 4, 0, 0, 0, 110);
  anvil.fillRect(12, 16, 12, 12, 30, 41, 59, 255);
  anvil.fillRect(4, 10, 28, 8, 71, 85, 105, 255);
  anvil.fillRect(20, 8, 8, 4, 251, 146, 60, 255); // hot glowing ingot
  savePng(propsDir, 'forge_anvil.png', anvil);

  // 7. Bench / Sitting Area
  const bench = new PixelCanvas(32, 24);
  bench.fillEllipse(16, 20, 12, 4, 0, 0, 0, 90);
  bench.fillRect(4, 8, 24, 6, 120, 53, 15, 255);
  bench.fillRect(6, 14, 4, 6, 69, 26, 3, 255);
  bench.fillRect(22, 14, 4, 6, 69, 26, 3, 255);
  savePng(propsDir, 'stone_bench.png', bench);
}

// ----------------------------------------------------------------------------
// RUN GENERATION
// ----------------------------------------------------------------------------
console.log('--- Generating Environments ---');
generateEnvironments();
console.log('--- Generating Buildings ---');
generateBuildings();
console.log('--- Generating Props ---');
generateProps();
console.log('=== All World Assets Generated Successfully ===');
