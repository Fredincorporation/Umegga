import Phaser from 'phaser';
import { BaseScene, PortalDef, BuildingDef, PropDef } from './BaseScene';

export class OracleBasinScene extends BaseScene {
  constructor() {
    super('OracleBasinScene');
  }

  createEnvironment() {
    this.addDistrictBackground('env_bg_oracle');
    const tileSize = 32;
    const cols = Math.ceil(this.mapWidth / tileSize);
    const rows = Math.ceil(this.mapHeight / tileSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * tileSize + tileSize / 2;
        const y = r * tileSize + tileSize / 2;

        const distFromCenter = Phaser.Math.Distance.Between(x, y, this.mapWidth / 2, this.mapHeight / 2);
        const isAstralPool = distFromCenter < 180 && distFromCenter > 110;
        const isCenterIsland = distFromCenter <= 110;
        const isRoad = Math.abs(x - this.mapWidth / 2) < 40 || Math.abs(y - this.mapHeight / 2) < 40;

        if (isAstralPool) {
          const water = this.add.image(x, y, 'tile_water_oracle');
          water.setDisplaySize(tileSize, tileSize);
          water.setAlpha(0.95);
          water.setDepth(0);
        } else if (isCenterIsland || isRoad) {
          const cobble = this.add.image(x, y, 'tile_cobble_oracle');
          cobble.setDisplaySize(tileSize, tileSize);
          cobble.setDepth(0);
        } else {
          const grass = this.add.image(x, y, 'tile_grass_oracle');
          grass.setDisplaySize(tileSize, tileSize);
          grass.setDepth(0);
        }
      }
    }

    // Central Astral Eye Monument
    const eyeAura = this.add.circle(this.mapWidth / 2, this.mapHeight / 2, 54, 0xa855f7, 0.3);
    eyeAura.setDepth(this.mapHeight / 2 - 5);
    this.tweens.add({
      targets: eyeAura,
      scale: 1.4,
      alpha: 0.55,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  protected definePortals(): PortalDef[] {
    return [
      {
        id: 'portal_oracle_to_sanc',
        x: 600,
        y: 1140,
        targetScene: 'SanctuaryScene',
        targetPortalId: 'portal_sanc_to_oracle',
        label: 'To Sanctuary',
        colorHex: 0x38bdf8,
        gateTexture: 'prop_portal_gate_cyan',
      },
      {
        id: 'portal_oracle_to_grove',
        x: 1128,
        y: 600,
        targetScene: 'BotanistGroveScene',
        targetPortalId: 'portal_grove_to_oracle',
        label: 'To Botanist Grove',
        colorHex: 0x4ade80,
        gateTexture: 'prop_portal_gate_green',
      },
      {
        id: 'portal_oracle_to_march',
        x: 72,
        y: 600,
        targetScene: 'FrayingMarchScene',
        targetPortalId: 'portal_march_to_oracle',
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
        y: 220,
        texture: 'bld_living_library',
        name: 'Living Library of the Void',
        scale: 0.85,
      },
      {
        x: 250,
        y: 470,
        texture: 'bld_shrine',
        name: 'Shrine of Prophetic Stars',
        scale: 0.75,
      },
      {
        x: 950,
        y: 470,
        texture: 'bld_shrine',
        name: 'Shadow Oracle Altar',
        scale: 0.72,
      },
    ];
  }

  protected defineProps(): PropDef[] {
    return [
      { x: 600, y: 510, texture: 'prop_memory_crystal', scale: 0.65, isSolid: true },
      { x: 430, y: 560, texture: 'prop_communication_orb', scale: 0.55, isSolid: true },
      { x: 770, y: 560, texture: 'prop_communication_orb', scale: 0.55, isSolid: true },
      { x: 300, y: 700, texture: 'prop_story_lantern' },
      { x: 900, y: 700, texture: 'prop_story_lantern' },
      { x: 600, y: 760, texture: 'prop_story_stone', scale: 0.55, isSolid: true },
      { x: 420, y: 900, texture: 'prop_pathway_marker', isSolid: true },
      { x: 780, y: 900, texture: 'prop_pathway_marker', isSolid: true },
    ];
  }

  getDefaultSpawn(): { x: number; y: number } {
    return { x: 600, y: 680 };
  }
}
