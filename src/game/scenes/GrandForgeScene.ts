import { BaseScene, PortalDef, BuildingDef, PropDef } from './BaseScene';

export class GrandForgeScene extends BaseScene {
  constructor() {
    super('GrandForgeScene');
  }

  createEnvironment() {
    this.addDistrictBackground('env_bg_forge');
    const tileSize = 32;
    const cols = Math.ceil(this.mapWidth / tileSize);
    const rows = Math.ceil(this.mapHeight / tileSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tileSize + tileSize / 2;
        const y = r * tileSize + tileSize / 2;

        // Magma canals & star-iron paved smelting bays
        const isLavaCanal = (x > 300 && x < 340) || (x > 860 && x < 900) || (y > 780 && y < 815);
        const isForgeFloor = Math.abs(x - 600) < 220 && Math.abs(y - 600) < 220;

        if (isLavaCanal) {
          const lava = this.add.image(x, y, 'tile_water_forge');
          lava.setDisplaySize(tileSize, tileSize);
          lava.setAlpha(0.95);
          lava.setDepth(0);
        } else if (isForgeFloor) {
          const cobble = this.add.image(x, y, 'tile_cobble_forge');
          cobble.setDisplaySize(tileSize, tileSize);
          cobble.setDepth(0);
        } else {
          const grass = this.add.image(x, y, 'tile_grass_forge');
          grass.setDisplaySize(tileSize, tileSize);
          grass.setDepth(0);
        }
      }
    }

    // Molten Heart Core Flame
    const forgeAura = this.add.circle(600, 600, 52, 0xf97316, 0.35);
    forgeAura.setDepth(595);
    this.tweens.add({
      targets: forgeAura,
      scale: 1.45,
      alpha: 0.6,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  protected definePortals(): PortalDef[] {
    return [
      {
        id: 'portal_forge_to_sanc',
        x: 600,
        y: 72,
        targetScene: 'SanctuaryScene',
        targetPortalId: 'portal_sanc_to_forge',
        label: 'To Sanctuary',
        colorHex: 0x38bdf8,
        gateTexture: 'prop_portal_gate_cyan',
      },
      {
        id: 'portal_forge_to_bard',
        x: 72,
        y: 600,
        targetScene: 'BardsAmphitheatreScene',
        targetPortalId: 'portal_bard_to_forge',
        label: "To Bard's Amphitheatre",
        colorHex: 0xfb7185,
        gateTexture: 'prop_portal_gate_rose',
      },
      {
        id: 'portal_forge_to_march',
        x: 1128,
        y: 600,
        targetScene: 'FrayingMarchScene',
        targetPortalId: 'portal_march_to_forge',
        label: 'To Fraying March',
        colorHex: 0x2dd4bf,
        gateTexture: 'prop_portal_gate_teal',
      },
    ];
  }

  protected defineBuildings(): BuildingDef[] {
    return [
      {
        x: 600,
        y: 250,
        texture: 'bld_builder_workshop',
        name: 'Grand Builder Workshop',
        scale: 0.86,
      },
      {
        x: 820,
        y: 270,
        texture: 'bld_magma_furnace',
        name: 'Magma Furnace',
        scale: 0.82,
        fitWidth: 150,
        fitHeight: 150,
      },
      {
        x: 250,
        y: 760,
        texture: 'bld_modular_house_b',
        name: 'Forge Quarters',
        scale: 0.72,
      },
    ];
  }

  protected defineProps(): PropDef[] {
    return [
      { x: 430, y: 560, texture: 'prop_builder_modular', isSolid: true },
      { x: 600, y: 520, texture: 'prop_forge_anvil', isSolid: true },
      { x: 770, y: 560, texture: 'prop_ground_node', isSolid: true },
      { x: 350, y: 900, texture: 'prop_pathway_marker', isSolid: true },
      { x: 850, y: 900, texture: 'prop_simple_bench', isSolid: true },
      { x: 600, y: 680, texture: 'prop_story_lantern' },
    ];
  }

  getDefaultSpawn(): { x: number; y: number } {
    return { x: 600, y: 660 };
  }
}
