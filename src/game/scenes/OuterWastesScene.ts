import { BaseScene, PortalDef, BuildingDef, PropDef } from './BaseScene';

export class OuterWastesScene extends BaseScene {
  constructor() {
    super('OuterWastesScene');
  }

  createEnvironment() {
    this.addDistrictBackground('env_outer');

    const cliffCity = this.add.image(1010, 300, 'env_clifs');
    cliffCity.setDisplaySize(420, 720).setAlpha(0.72).setDepth(-4);

    // outer.png already contains the desert floor; keep only lightweight path accents.
    this.add.rectangle(520, 600, 72, 1080, 0x8b7355, 0.16).setDepth(-3);
    this.add.rectangle(520, 850, 940, 56, 0x8b7355, 0.14).setDepth(-3);
  }

  getPortals(): PortalDef[] {
    return [
      {
        id: 'portal_wastes_to_sanc',
        x: 1080,
        y: 1080,
        targetScene: 'SanctuaryScene',
        targetPortalId: 'portal_sanc_to_wastes',
        label: 'To Umegga Sanctuary',
        colorHex: 0x38bdf8,
        gateTexture: 'prop_portal_gate_cyan',
      },
      {
        id: 'portal_wastes_to_march',
        x: 120,
        y: 180,
        targetScene: 'FrayingMarchScene',
        targetPortalId: 'portal_march_to_wastes',
        label: 'To Fraying March',
        colorHex: 0x94a3b8,
        gateTexture: 'prop_portal_gate_teal',
      },
    ];
  }

  getBuildings(): BuildingDef[] {
    return [
      {
        x: 820,
        y: 260,
        texture: 'bld_ancient_gate',
        name: 'Distant Ruined Gate',
        scale: 0.7,
      },
    ];
  }

  getProps(): PropDef[] {
    return [
      { x: 260, y: 390, texture: 'prop_story_stone', scale: 0.5, isSolid: true },
      { x: 720, y: 700, texture: 'prop_pathway_marker', scale: 0.45, isSolid: true },
      { x: 940, y: 860, texture: 'prop_story_stone', scale: 0.45, isSolid: true },
    ];
  }

  getDefaultSpawn(): { x: number; y: number } {
    return { x: 520, y: 900 };
  }
}
