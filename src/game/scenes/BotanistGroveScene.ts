import { BaseScene, PortalDef, BuildingDef, PropDef } from './BaseScene';

export class BotanistGroveScene extends BaseScene {
  constructor() {
    super('BotanistGroveScene');
  }

  createEnvironment() {
    this.addDistrictBackground('env_bg_grove');
    const tileSize = 32;
    const cols = Math.ceil(this.mapWidth / tileSize);
    const rows = Math.ceil(this.mapHeight / tileSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tileSize + tileSize / 2;
        const y = r * tileSize + tileSize / 2;

        // Winding green biomatter rivers and overgrown garden paths
        const isRiver = Math.sin(x / 90) * 80 + 600 > y - 20 && Math.sin(x / 90) * 80 + 600 < y + 20;
        const isGardenPath = Math.abs(x - 600) < 36 || Math.abs(y - 600) < 36;

        if (isRiver) {
          const water = this.add.image(x, y, 'tile_water_grove');
          water.setDisplaySize(tileSize, tileSize);
          water.setAlpha(0.9);
          water.setDepth(0);
        } else if (isGardenPath) {
          const cobble = this.add.image(x, y, 'tile_cobble_grove');
          cobble.setDisplaySize(tileSize, tileSize);
          cobble.setDepth(0);
        } else {
          const grass = this.add.image(x, y, 'tile_grass_grove');
          grass.setDisplaySize(tileSize, tileSize);
          grass.setDepth(0);
        }
      }
    }

    // World Root Mother Tree Aura
    const rootAura = this.add.circle(600, 600, 60, 0x22c55e, 0.25);
    rootAura.setDepth(595);
    this.tweens.add({
      targets: rootAura,
      scale: 1.35,
      alpha: 0.45,
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  getPortals(): PortalDef[] {
    return [
      {
        id: 'portal_grove_to_sanc',
        x: 72,
        y: 1128,
        targetScene: 'SanctuaryScene',
        targetPortalId: 'portal_sanc_to_grove',
        label: 'To Sanctuary',
        colorHex: 0x38bdf8,
        gateTexture: 'prop_portal_gate_cyan',
      },
      {
        id: 'portal_grove_to_oracle',
        x: 72,
        y: 72,
        targetScene: 'OracleBasinScene',
        targetPortalId: 'portal_oracle_to_grove',
        label: 'To Oracle Basin',
        colorHex: 0xc084fc,
        gateTexture: 'prop_portal_gate_purple',
      },
      {
        id: 'portal_grove_to_bard',
        x: 1128,
        y: 600,
        targetScene: 'BardsAmphitheatreScene',
        targetPortalId: 'portal_bard_to_grove',
        label: "To Bard's Amphitheatre",
        colorHex: 0xfb7185,
        gateTexture: 'prop_portal_gate_rose',
      },
    ];
  }

  getBuildings(): BuildingDef[] {
    return [
      {
        x: 520,
        y: 230,
        texture: 'bld_living_library',
        name: 'Living Botanical Library',
        scale: 0.85,
      },
      {
        x: 220,
        y: 720,
        texture: 'bld_modular_house_a',
        name: 'Botanist Hermitage',
        scale: 0.75,
      },
      {
        x: 940,
        y: 760,
        texture: 'bld_shrine',
        name: 'Shrine of the World-Root',
        scale: 0.72,
      },
    ];
  }

  getProps(): PropDef[] {
    return [
      { x: 520, y: 500, texture: 'prop_ground_node', isSolid: true },
      { x: 350, y: 560, texture: 'prop_story_stone', isSolid: true },
      { x: 760, y: 540, texture: 'prop_memory_crystal', scale: 0.6, isSolid: true },
      { x: 440, y: 850, texture: 'prop_simple_bench', isSolid: true },
      { x: 700, y: 850, texture: 'prop_simple_bench', isSolid: true },
      { x: 260, y: 500, texture: 'prop_story_lantern' },
      { x: 900, y: 500, texture: 'prop_story_lantern' },
    ];
  }

  getDefaultSpawn(): { x: number; y: number } {
    return { x: 600, y: 660 };
  }
}
