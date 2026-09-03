import Phaser from 'phaser';
import { BaseScene, PortalDef, BuildingDef, PropDef } from './BaseScene';

export class BardsAmphitheatreScene extends BaseScene {
  constructor() {
    super('BardsAmphitheatreScene');
  }

  createEnvironment() {
    this.addDistrictBackground('env_bg_amphitheatre');
    const tileSize = 32;
    const cols = Math.ceil(this.mapWidth / tileSize);
    const rows = Math.ceil(this.mapHeight / tileSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tileSize + tileSize / 2;
        const y = r * tileSize + tileSize / 2;

        // Circular concentric tiered amphitheatre marble terraces
        const distFromCenter = Phaser.Math.Distance.Between(x, y, 600, 600);
        const isRoseReflectingPool = distFromCenter > 220 && distFromCenter < 260;
        const isTerrace = distFromCenter <= 220;

        if (isRoseReflectingPool) {
          const water = this.add.image(x, y, 'tile_water_amphitheatre');
          water.setDisplaySize(tileSize, tileSize);
          water.setAlpha(0.9);
          water.setDepth(0);
        } else if (isTerrace) {
          const cobble = this.add.image(x, y, 'tile_cobble_amphitheatre');
          cobble.setDisplaySize(tileSize, tileSize);
          cobble.setDepth(0);
        } else {
          const grass = this.add.image(x, y, 'tile_grass_amphitheatre');
          grass.setDisplaySize(tileSize, tileSize);
          grass.setDepth(0);
        }
      }
    }

    // Melodic Acoustic Sound Wave Aura
    const melodyAura = this.add.circle(600, 600, 56, 0xf43f5e, 0.3);
    melodyAura.setDepth(595);
    this.tweens.add({
      targets: melodyAura,
      scale: 1.4,
      alpha: 0.5,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  getPortals(): PortalDef[] {
    return [
      {
        id: 'portal_bard_to_sanc',
        x: 600,
        y: 72,
        targetScene: 'SanctuaryScene',
        targetPortalId: 'portal_sanc_to_bard',
        label: 'To Sanctuary',
        colorHex: 0x38bdf8,
        gateTexture: 'prop_portal_gate_cyan',
      },
      {
        id: 'portal_bard_to_grove',
        x: 72,
        y: 600,
        targetScene: 'BotanistGroveScene',
        targetPortalId: 'portal_grove_to_bard',
        label: 'To Botanist Grove',
        colorHex: 0x4ade80,
        gateTexture: 'prop_portal_gate_green',
      },
      {
        id: 'portal_bard_to_forge',
        x: 1128,
        y: 600,
        targetScene: 'GrandForgeScene',
        targetPortalId: 'portal_forge_to_bard',
        label: 'To Grand Forge',
        colorHex: 0xfb923c,
        gateTexture: 'prop_portal_gate_orange',
      },
    ];
  }

  getBuildings(): BuildingDef[] {
    return [
      {
        x: 600,
        y: 250,
        texture: 'bld_council_hall',
        name: 'Amphitheatre Council Hall',
        scale: 0.84,
      },
      {
        x: 250,
        y: 780,
        texture: 'bld_bard_academy',
        name: 'Bard Academy',
        scale: 0.82,
        fitWidth: 200,
        fitHeight: 185,
      },
      {
        x: 950,
        y: 780,
        texture: 'bld_shrine',
        name: 'Shrine of Resonance',
        scale: 0.7,
      },
    ];
  }

  getProps(): PropDef[] {
    return [
      { x: 360, y: 430, texture: 'prop_banner' },
      { x: 840, y: 430, texture: 'prop_banner' },
      { x: 350, y: 650, texture: 'prop_story_lantern' },
      { x: 850, y: 650, texture: 'prop_story_lantern' },
      { x: 400, y: 850, texture: 'prop_simple_bench', isSolid: true },
      { x: 800, y: 850, texture: 'prop_simple_bench', isSolid: true },
      { x: 600, y: 500, texture: 'prop_story_stone', isSolid: true },
      { x: 600, y: 420, texture: 'prop_communication_orb', isSolid: true },
    ];
  }

  getDefaultSpawn(): { x: number; y: number } {
    return { x: 600, y: 660 };
  }
}
