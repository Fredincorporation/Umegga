import { BaseScene, PortalDef, BuildingDef, PropDef } from './BaseScene';

export class FrayingMarchScene extends BaseScene {
  constructor() {
    super('FrayingMarchScene');
  }

  createEnvironment() {
    this.addDistrictBackground('env_bg_march');
    const tileSize = 32;
    const cols = Math.ceil(this.mapWidth / tileSize);
    const rows = Math.ceil(this.mapHeight / tileSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tileSize + tileSize / 2;
        const y = r * tileSize + tileSize / 2;

        // Jagged dimensional reality rift cracks and fortified outpost plazas
        const isRiftChasm = Math.abs((x - y) % 240) < 22 || Math.abs((x + y) % 360) < 24;
        const isPlaza = Math.abs(x - 600) < 180 && Math.abs(y - 600) < 180;

        if (isRiftChasm) {
          const water = this.add.image(x, y, 'tile_water_march');
          water.setDisplaySize(tileSize, tileSize);
          water.setAlpha(0.95);
          water.setDepth(0);
        } else if (isPlaza) {
          const cobble = this.add.image(x, y, 'tile_cobble_march');
          cobble.setDisplaySize(tileSize, tileSize);
          cobble.setDepth(0);
        } else {
          const grass = this.add.image(x, y, 'tile_grass_march');
          grass.setDisplaySize(tileSize, tileSize);
          grass.setDepth(0);
        }
      }
    }

    // Dimensional Singularity Vortex
    const vortexAura = this.add.circle(600, 600, 50, 0x2dd4bf, 0.35);
    vortexAura.setDepth(595);
    this.tweens.add({
      targets: vortexAura,
      scale: 1.5,
      alpha: 0.6,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  getPortals(): PortalDef[] {
    return [
      {
        id: 'portal_march_to_sanc',
        x: 600,
        y: 72,
        targetScene: 'SanctuaryScene',
        targetPortalId: 'portal_sanc_to_march',
        label: 'To Sanctuary',
        colorHex: 0x38bdf8,
        gateTexture: 'prop_portal_gate_cyan',
      },
      {
        id: 'portal_march_to_oracle',
        x: 72,
        y: 600,
        targetScene: 'OracleBasinScene',
        targetPortalId: 'portal_oracle_to_march',
        label: 'To Oracle Basin',
        colorHex: 0xc084fc,
        gateTexture: 'prop_portal_gate_purple',
      },
      {
        id: 'portal_march_to_forge',
        x: 1128,
        y: 600,
        targetScene: 'GrandForgeScene',
        targetPortalId: 'portal_forge_to_march',
        label: 'To Grand Forge',
        colorHex: 0xfb923c,
        gateTexture: 'prop_portal_gate_orange',
      },
      {
        id: 'portal_march_to_wastes',
        x: 1128,
        y: 1128,
        targetScene: 'OuterWastesScene',
        targetPortalId: 'portal_wastes_to_march',
        label: 'To Outer Wastes',
        colorHex: 0x94a3b8,
        gateTexture: 'prop_portal_gate_teal',
      },
    ];
  }

  getBuildings(): BuildingDef[] {
    return [
      {
        x: 600,
        y: 230,
        texture: 'bld_ancient_gate',
        name: 'Ancient Gate',
        scale: 0.82,
      },
      {
        x: 240,
        y: 760,
        texture: 'bld_modular_house_b',
        name: 'March Outpost',
        scale: 0.72,
      },
      {
        x: 980,
        y: 700,
        texture: 'bld_shrine',
        name: 'Shrine of the Frayed Edge',
        scale: 0.7,
      },
    ];
  }

  getProps(): PropDef[] {
    return [
      { x: 440, y: 520, texture: 'prop_pathway_marker', isSolid: true },
      { x: 760, y: 520, texture: 'prop_story_stone', isSolid: true },
      { x: 480, y: 700, texture: 'prop_banner' },
      { x: 720, y: 700, texture: 'prop_builder_modular', isSolid: true },
      { x: 600, y: 600, texture: 'prop_ground_node', isSolid: true },
      { x: 600, y: 460, texture: 'prop_story_lantern' },
    ];
  }

  getDefaultSpawn(): { x: number; y: number } {
    return { x: 600, y: 660 };
  }
}
