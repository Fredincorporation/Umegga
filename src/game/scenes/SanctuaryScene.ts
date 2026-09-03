import Phaser from 'phaser';
import { BaseScene, PortalDef, BuildingDef, PropDef } from './BaseScene';

export class SanctuaryScene extends BaseScene {
  constructor() {
    super('SanctuaryScene');
  }

  createEnvironment() {
    this.addDistrictBackground('env_bg_sanctuary');
    const tileSize = 32;
    const cols = Math.ceil(this.mapWidth / tileSize);
    const rows = Math.ceil(this.mapHeight / tileSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tileSize + tileSize / 2;
        const y = r * tileSize + tileSize / 2;

        const distFromCenter = Phaser.Math.Distance.Between(x, y, this.mapWidth / 2, this.mapHeight / 2);
        const isPlaza = distFromCenter < 240;
        const isRoadX = Math.abs(y - this.mapHeight / 2) < 48;
        const isRoadY = Math.abs(x - this.mapWidth / 2) < 48;
        const isCanal = (x > 180 && x < 210) || (x > 990 && x < 1020);

        if (isCanal) {
          const water = this.add.image(x, y, 'tile_water_sanctuary');
          water.setDisplaySize(tileSize, tileSize);
          water.setAlpha(0.9);
          water.setDepth(0);
        } else if (isPlaza || isRoadX || isRoadY) {
          const cobble = this.add.image(x, y, 'tile_cobble_sanctuary');
          cobble.setDisplaySize(tileSize, tileSize);
          cobble.setDepth(0);
        } else {
          const grass = this.add.image(x, y, 'tile_grass_sanctuary');
          grass.setDisplaySize(tileSize, tileSize);
          grass.setDepth(0);
        }
      }
    }

    // Central Story Spire Aura
    const centralAura = this.add.circle(this.mapWidth / 2, this.mapHeight / 2 + 10, 48, 0x38bdf8, 0.25);
    centralAura.setDepth(this.mapHeight / 2 - 5);
    this.tweens.add({
      targets: centralAura,
      scale: 1.3,
      alpha: 0.45,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  getPortals(): PortalDef[] {
    return [
      {
        id: 'portal_sanc_to_oracle',
        x: 72,
        y: 72,
        targetScene: 'OracleBasinScene',
        targetPortalId: 'portal_oracle_to_sanc',
        label: 'To Oracle Basin',
        colorHex: 0xc084fc,
        gateTexture: 'prop_portal_gate_purple',
      },
      {
        id: 'portal_sanc_to_grove',
        x: 1128,
        y: 72,
        targetScene: 'BotanistGroveScene',
        targetPortalId: 'portal_grove_to_sanc',
        label: 'To Botanist Grove',
        colorHex: 0x4ade80,
        gateTexture: 'prop_portal_gate_green',
      },
      {
        id: 'portal_sanc_to_bard',
        x: 72,
        y: 1128,
        targetScene: 'BardsAmphitheatreScene',
        targetPortalId: 'portal_bard_to_sanc',
        label: "To Bard's Amphitheatre",
        colorHex: 0xfb7185,
        gateTexture: 'prop_portal_gate_rose',
      },
      {
        id: 'portal_sanc_to_forge',
        x: 1128,
        y: 1128,
        targetScene: 'GrandForgeScene',
        targetPortalId: 'portal_forge_to_sanc',
        label: 'To Grand Forge',
        colorHex: 0xfb923c,
        gateTexture: 'prop_portal_gate_orange',
      },
      {
        id: 'portal_sanc_to_march',
        x: 600,
        y: 1140,
        targetScene: 'FrayingMarchScene',
        targetPortalId: 'portal_march_to_sanc',
        label: 'To Fraying March',
        colorHex: 0x2dd4bf,
        gateTexture: 'prop_portal_gate_teal',
      },
      {
        id: 'portal_sanc_to_wastes',
        x: 1140,
        y: 600,
        targetScene: 'OuterWastesScene',
        targetPortalId: 'portal_wastes_to_sanc',
        label: 'To Outer Wastes',
        colorHex: 0xa8a29e,
        gateTexture: 'prop_portal_gate_teal',
      },
    ];
  }

  getBuildings(): BuildingDef[] {
    return [
      {
        x: 600,
        y: 600,
        texture: 'bld_story_spire',
        name: 'Grand Story Spire',
        scale: 0.8,
      },
      {
        x: 150,
        y: 260,
        texture: 'bld_council_hall',
        name: 'High Arbiter Council Hall',
        scale: 0.78,
      },
      {
        x: 1050,
        y: 260,
        texture: 'bld_shrine',
        name: 'Shrine of the First Weaver',
        scale: 0.7,
      },
      {
        x: 150,
        y: 980,
        texture: 'bld_modular_house_a',
        name: 'Weaver Quarters',
        scale: 0.72,
      },
      {
        x: 1050,
        y: 980,
        texture: 'bld_modular_house_b',
        name: 'Scholar Lodge',
        scale: 0.72,
      },
    ];
  }

  getProps(): PropDef[] {
    return [
      { x: 600, y: 520, texture: 'prop_story_stone', isSolid: true },
      { x: 430, y: 560, texture: 'prop_law_tablet', isSolid: true },
      { x: 770, y: 560, texture: 'prop_law_tablet', isSolid: true },
      { x: 300, y: 610, texture: 'prop_story_lantern' },
      { x: 900, y: 610, texture: 'prop_story_lantern' },
      { x: 180, y: 760, texture: 'prop_simple_bench', isSolid: true },
      { x: 1020, y: 760, texture: 'prop_simple_bench', isSolid: true },
      { x: 600, y: 700, texture: 'prop_ground_node', isSolid: true },
      { x: 360, y: 780, texture: 'prop_pathway_marker', isSolid: true },
      { x: 840, y: 780, texture: 'prop_pathway_marker', isSolid: true },
      { x: 360, y: 300, texture: 'prop_banner' },
      { x: 840, y: 300, texture: 'prop_banner' },
      { x: 440, y: 820, texture: 'prop_tree_willow', isSolid: true },
      { x: 760, y: 820, texture: 'prop_tree_crystal', isSolid: true },
    ];
  }

  getDefaultSpawn(): { x: number; y: number } {
    return { x: 600, y: 640 };
  }
}
