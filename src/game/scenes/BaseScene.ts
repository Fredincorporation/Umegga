import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { AgentEntity } from '../entities/AgentEntity';
import { useGameStore } from '../../store/useGameStore';
import { SceneKey, WeatherType } from '../../types/game';

export interface PortalDef {
  id: string;
  x: number;
  y: number;
  targetScene: SceneKey;
  targetPortalId: string;
  label: string;
  colorHex: number;
  gateTexture: string;
}

export interface BuildingDef {
  x: number;
  y: number;
  texture: string;
  scale?: number;
  /** Override the max on-screen size used to fit the sprite (source textures vary in aspect). */
  fitWidth?: number;
  fitHeight?: number;
  solidWidth?: number;
  solidHeight?: number;
  name?: string;
}

export interface PropDef {
  x: number;
  y: number;
  texture: string;
  scale?: number;
  isSolid?: boolean;
}

export interface SceneInitData {
  spawnPortalId?: string;
  spawnX?: number;
  spawnY?: number;
  fromScene?: SceneKey;
}

export abstract class BaseScene extends Phaser.Scene {
  public sceneKey: SceneKey;
  public mapWidth = 1200;
  public mapHeight = 1200;

  public player!: Player;
  public agents: Map<string, AgentEntity> = new Map();
  public agentsGroup!: Phaser.Physics.Arcade.Group;
  public solidGroup!: Phaser.Physics.Arcade.StaticGroup;

  protected portals: PortalDef[] = [];
  protected isTransitioning = false;
  protected portalCooldown = 800;
  protected lastTransitionTime = 0;

  private weatherOverlay!: Phaser.GameObjects.Rectangle;
  private particleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private unsubscribeStore?: () => void;
  private renderedStructureIds = new Set<string>();
  private placedProps?: PropDef[];

  private readonly sceneTheme: Record<SceneKey, { tint: number; particleTint: number[] }> = {
    SanctuaryScene: { tint: 0x38bdf8, particleTint: [0x7dd3fc, 0x38bdf8, 0xe0f2fe] },
    OracleBasinScene: { tint: 0xa855f7, particleTint: [0xd8b4fe, 0xa855f7, 0xf5d0fe] },
    BotanistGroveScene: { tint: 0x22c55e, particleTint: [0x86efac, 0x22c55e, 0xdcfce7] },
    GrandForgeScene: { tint: 0xf97316, particleTint: [0xfdba74, 0xf97316, 0xfef3c7] },
    BardsAmphitheatreScene: { tint: 0xfacc15, particleTint: [0xfef08a, 0xfacc15, 0xfffbeb] },
    FrayingMarchScene: { tint: 0x94a3b8, particleTint: [0xcbd5e1, 0x94a3b8, 0x64748b] },
    OuterWastesScene: { tint: 0x78716c, particleTint: [0xd6d3d1, 0xa8a29e, 0x57534e] },
  };

  constructor(sceneKey: SceneKey) {
    super({ key: sceneKey });
    this.sceneKey = sceneKey;
  }

  abstract createEnvironment(): void;
  abstract getPortals(): PortalDef[];
  abstract getBuildings(): BuildingDef[];
  abstract getProps(): PropDef[];
  abstract getDefaultSpawn(): { x: number; y: number };

  init(_data: SceneInitData) {
    this.isTransitioning = false;
    this.lastTransitionTime = Date.now();
  }

  create(data: SceneInitData) {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupScene, this);
    this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);

    // 1. Create District Tile Environment
    this.createEnvironment();

    // 2. Physics Groups for Collisions
    this.agentsGroup = this.physics.add.group();
    this.solidGroup = this.physics.add.staticGroup();
    this.agents.clear();

    // 3. Build Structures & Static Props
    this.buildDistrictStructures();

    // 4. Resolve portal destinations before calculating the spawn point.
    this.portals = this.getPortals();

    // 5. Spawn Player (at portal arrival or default spawn)
    const spawnPos = this.calculateSpawnPosition(data);
    const initialChar = useGameStore.getState().player.characterId;
    this.player = new Player(this, spawnPos.x, spawnPos.y, initialChar);
    useGameStore.getState().setPlayerScene(this.sceneKey, spawnPos.x, spawnPos.y);

    // 6. Build portal triggers after the player exists.
    this.buildDistrictPortals();

    // 7. Spawn Agents Assigned to this Scene
    this.spawnSceneAgents();

    // 8. Setup Arcade Collisions
    this.setupCollisions();

    // 9. Setup Camera (NO MOUSE WHEEL ZOOM - Disabled per Critical Fix)
    this.setupCamera();

    // 10. Atmospheric Weather Overlay & Ambient VFX
    this.setupAtmosphereAndVFX();

    // 11. Subscribe to Zustand Store
    this.subscribeToStore();

    // 12. Camera Fade In on scene entry
    this.cameras.main.fadeIn(350, 2, 6, 23);
    this.showAreaEntry(data?.fromScene);
    if (this.sceneKey === 'SanctuaryScene') {
      this.registry.get('onReady')?.();
    }
  }

  protected calculateSpawnPosition(data: SceneInitData): { x: number; y: number } {
    let desired = this.getDefaultSpawn();
    if (data?.spawnX !== undefined && data?.spawnY !== undefined) {
      desired = { x: data.spawnX, y: data.spawnY };
    } else if (data?.spawnPortalId) {
      const targetPortal = this.portals.find((p) => p.id === data.spawnPortalId);
      if (targetPortal) {
        // Spawn slightly below portal entrance
        desired = {
          x: targetPortal.x,
          y: Math.min(this.mapHeight - 60, targetPortal.y + 48),
        };
      }
    }
    return this.findSafeSpawn(desired);
  }

  private findSafeSpawn(desired: { x: number; y: number }) {
    const candidates = [desired, { x: desired.x + 64, y: desired.y }, { x: desired.x - 64, y: desired.y }, this.getDefaultSpawn()];
    return candidates.find((candidate) => {
      const nearBuilding = this.getBuildings().some((building) => Phaser.Math.Distance.Between(candidate.x, candidate.y, building.x, building.y) < 100);
      const nearProp = this.getPlacedProps().some((prop) => Phaser.Math.Distance.Between(candidate.x, candidate.y, prop.x, prop.y) < 52);
      const nearPortal = this.portals.some((portal) => Phaser.Math.Distance.Between(candidate.x, candidate.y, portal.x, portal.y) < 58);
      return !nearBuilding && !nearProp && !nearPortal;
    }) || { x: 600, y: 640 };
  }

  private fitToWorldBounds(object: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) {
    const source = object.texture.getSourceImage() as HTMLImageElement;
    const sourceWidth = source.width || object.width;
    const sourceHeight = source.height || object.height;
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    object.setScale(scale);
    return scale;
  }

  protected buildDistrictStructures() {
    const buildings = this.getBuildings();
    buildings.forEach((b) => {
      const sprite = this.add.image(b.x, b.y, b.texture);
      const buildingScale = Phaser.Math.Clamp((b.scale || 0.75) * (0.94 + (b.y / this.mapHeight) * 0.12), 0.65, 0.9);
      this.fitToWorldBounds(
        sprite,
        b.fitWidth ?? 280 * (buildingScale / 0.75),
        b.fitHeight ?? 260 * (buildingScale / 0.75),
      );
      sprite.setOrigin(0.5, 0.85);
      sprite.setDepth(1000 + b.y);

      // Add static collider footprint
      const solidW = b.solidWidth || Math.max(32, sprite.displayWidth);
      const solidH = b.solidHeight || Math.max(24, sprite.displayHeight + 36);
      const colliderX = b.x;
      const colliderY = b.y - sprite.displayHeight * 0.5 + 18;

      const solidBody = this.add.rectangle(colliderX, colliderY, solidW, solidH, 0x000000, 0);
      this.physics.world.enable(solidBody, Phaser.Physics.Arcade.STATIC_BODY);
      this.solidGroup.add(solidBody);

      // Building Label Tag
      if (b.name) {
        const text = this.add.text(b.x, b.y - sprite.displayHeight * 0.85 - 8, b.name, {
          fontSize: '11px',
          fontFamily: 'Cinzel, Georgia, serif',
          color: '#f1f5f9',
          backgroundColor: '#0f172acc',
          padding: { x: 5, y: 2 },
        }).setOrigin(0.5, 0.5);
        text.setDepth(3000 + b.y);
      }
    });

    const props = this.getPlacedProps();
    props.forEach((p) => {
      const propSprite = this.add.image(p.x, p.y, p.texture);
      const propScale = Phaser.Math.Clamp((p.scale || 0.5) * (0.94 + (p.y / this.mapHeight) * 0.12), 0.4, 0.7);
      this.fitToWorldBounds(propSprite, 78 * (propScale / 0.5), 78 * (propScale / 0.5));
      propSprite.setOrigin(0.5, 0.85);
      propSprite.setDepth(1000 + p.y);

      if (/story|law|lantern|crystal|orb|ground_node/.test(p.texture)) {
        const glow = this.add.circle(p.x, p.y - 4, 18, this.sceneTheme[this.sceneKey].tint, 0.16);
        glow.setDepth(900 + p.y - 1);
        this.tweens.add({ targets: glow, alpha: 0.32, scale: 1.15, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      if (/lantern|crystal|orb|story_stone/.test(p.texture)) {
        this.tweens.add({ targets: propSprite, y: p.y - 5, duration: 1800 + (p.x % 300), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }

      // All props are solid blocking static bodies at their base
      const solidW = Math.max(22, propSprite.displayWidth);
      const solidH = Math.max(18, propSprite.displayHeight);
      const solidBody = this.add.rectangle(p.x, p.y - solidH * 0.5, solidW, solidH, 0x000000, 0);
      this.physics.world.enable(solidBody, Phaser.Physics.Arcade.STATIC_BODY);
      this.solidGroup.add(solidBody);
    });
  }

  private getPlacedProps(): PropDef[] {
    if (this.placedProps) return this.placedProps;
    const fixedProps = this.getProps().filter((prop, index, props) => props.findIndex((candidate) => candidate.texture === prop.texture) === index);
    const randomPool = [
      'prop_tree_willow',
      'prop_rune_stone',
      'prop_street_lamp',
      'prop_tree_crystal',
    ];
    const occupied = [
      ...fixedProps.map((prop) => ({ x: prop.x, y: prop.y })),
      ...this.getBuildings().map((building) => ({ x: building.x, y: building.y })),
      ...this.getPortals().map((portal) => ({ x: portal.x, y: portal.y })),
    ];
    const randomProps: PropDef[] = [];
    const availableTextures = randomPool
      .filter((texture) => !fixedProps.some((prop) => prop.texture === texture))
      .sort(() => Math.random() - 0.5);
    for (const texture of availableTextures) {
      let x = 120 + Math.random() * 960;
      let y = 140 + Math.random() * 900;
      let attempts = 0;
      while (attempts < 20 && occupied.some((point) => Phaser.Math.Distance.Between(x, y, point.x, point.y) < 110)) {
        x = 120 + Math.random() * 960;
        y = 140 + Math.random() * 900;
        attempts += 1;
      }
      occupied.push({ x, y });
      randomProps.push({ x, y, texture, isSolid: true });
    }
    this.placedProps = [...fixedProps, ...randomProps];
    return this.placedProps;
  }

  protected addDistrictBackground(texture: string) {
    const theme = this.sceneTheme[this.sceneKey];
    const underlay = this.add.rectangle(
      this.mapWidth / 2,
      this.mapHeight / 2,
      this.mapWidth,
      this.mapHeight,
      theme.tint,
      1
    );
    underlay.setAlpha(1);
    underlay.setDepth(-11);

    const background = this.add.image(this.mapWidth / 2, this.mapHeight / 2, texture);
    background.setDisplaySize(this.mapWidth, this.mapHeight);
    background.setAlpha(0.35);
    background.setBlendMode(Phaser.BlendModes.SCREEN);
    background.setDepth(-10);
  }

  protected buildDistrictPortals() {
    this.portals.forEach((portal) => {
      // 1. Portal Gate Sprite
      const gate = this.add.image(portal.x, portal.y, portal.gateTexture);
      this.fitToWorldBounds(gate, 96, 112);
      gate.setOrigin(0.5, 0.75);
      gate.setDepth(1000 + portal.y - 5);

      // 2. Pulsing Glow Aura Ring
      const aura = this.add.circle(portal.x, portal.y + 4, 28, portal.colorHex, 0.22);
      aura.setDepth(900 + portal.y - 10);
      this.tweens.add({
        targets: aura,
        scale: 1.18,
        alpha: 0.6,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // 3. Floating Portal Signpost Label
      const labelText = this.add.text(portal.x, portal.y - 52, `⛩️ ${portal.label}`, {
        fontSize: '11px',
        fontFamily: 'Inter, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#0f172aee',
        padding: { x: 7, y: 3 },
      }).setOrigin(0.5, 0.5);
      labelText.setDepth(3000 + portal.y);

      // 4. Portal Trigger Sensor Zone
      const triggerZone = this.add.zone(portal.x, portal.y + 6, 44, 44);
      this.physics.world.enable(triggerZone, Phaser.Physics.Arcade.STATIC_BODY);

      // Overlap with player triggers transition
      this.physics.add.overlap(this.player, triggerZone, () => {
        this.triggerPortalTransition(portal);
      });
    });
  }

  public getPortalDefinitions(): PortalDef[] {
    return this.portals;
  }

  public transferAgentThroughPortal(agent: AgentEntity, portal: PortalDef): void {
    useGameStore.getState().moveAgentToScene(
      agent.agentId,
      portal.targetScene,
      portal.x,
      Math.min(this.mapHeight - 64, portal.y + 48)
    );
    this.agents.delete(agent.agentId);
    agent.destroy();
  }

  protected triggerPortalTransition(portal: PortalDef) {
    if (this.isTransitioning) return;
    const now = Date.now();
    if (now - this.lastTransitionTime < this.portalCooldown) return;

    this.isTransitioning = true;
    this.lastTransitionTime = now;

    // Flash camera lightly and fade out
    this.cameras.main.flash(200, 56, 189, 248);
    this.cameras.main.fade(300, 2, 6, 23, false, (_cam: any, progress: number) => {
      if (progress === 1) {
        this.scene.start(portal.targetScene, {
          spawnPortalId: portal.targetPortalId,
          fromScene: this.sceneKey,
        });
      }
    });

    const builtStructures = (useGameStore.getState().world.structures || [])
      .filter((structure) => structure.scene === this.sceneKey);
    builtStructures.forEach((structure) => {
      const textureKey = `bld_${structure.type}`;
      const texture = this.textures.exists(textureKey) ? textureKey : 'prop_builder_modular';
      const structureSprite = this.add.image(structure.x, structure.y, texture);
      this.fitToWorldBounds(structureSprite, 180, 180);
      structureSprite.setOrigin(0.5, 0.85);
      structureSprite.setDepth(1000 + structure.y);
      const structureBody = this.add.rectangle(structure.x, structure.y - 20, 90, 36, 0x000000, 0);
      this.physics.world.enable(structureBody, Phaser.Physics.Arcade.STATIC_BODY);
      this.solidGroup.add(structureBody);
      this.add.text(structure.x, structure.y - structureSprite.displayHeight - 8, structure.name, {
        fontSize: '10px',
        fontFamily: 'Cinzel, Georgia, serif',
        color: '#f8fafc',
        backgroundColor: '#0f172acc',
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(3000 + structure.y);
    });
  }

  protected spawnSceneAgents() {
    const allAgents = useGameStore.getState().agents;
    const sceneAgents = allAgents.filter((a) => {
      return a.characterId !== useGameStore.getState().player.characterId && a.currentScene === this.sceneKey;
    });

    sceneAgents.forEach((agentData) => {
      const agentEntity = new AgentEntity(this, agentData);
      this.agents.set(agentData.id, agentEntity);
      this.agentsGroup.add(agentEntity);
    });
    this.renderBuiltStructures(allAgents.length === 0);
  }

  private renderBuiltStructures(_initial = false) {
    const structures = (useGameStore.getState().world.structures || []).filter((structure) => structure.scene === this.sceneKey);
    structures.forEach((structure) => {
      if (this.renderedStructureIds.has(structure.id)) return;
      this.renderedStructureIds.add(structure.id);
      const textureKey = `bld_${structure.type}`;
      const texture = this.textures.exists(textureKey) ? textureKey : 'prop_builder_modular';
      const sprite = this.add.image(structure.x, structure.y, texture);
      this.fitToWorldBounds(sprite, 180, 180);
      sprite.setOrigin(0.5, 0.85).setDepth(1000 + structure.y);
      const body = this.add.rectangle(structure.x, structure.y - 20, 90, 36, 0x000000, 0);
      this.physics.world.enable(body, Phaser.Physics.Arcade.STATIC_BODY);
      this.solidGroup.add(body);
      this.add.text(structure.x, structure.y - sprite.displayHeight - 8, structure.name, { fontSize: '10px', fontFamily: 'Cinzel, Georgia, serif', color: '#f8fafc', backgroundColor: '#0f172acc', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(3000 + structure.y);
      this.cameras.main.flash(180, 251, 191, 36);
      this.particleEmitter?.explode(24, structure.x, structure.y - 20);
    });
  }

  private syncSceneAgents(state: ReturnType<typeof useGameStore.getState>) {
    if (!this.sys.settings.active || !this.agentsGroup) return;
    const sceneAgentData = state.agents.filter((agent) =>
      agent.characterId !== state.player.characterId && agent.currentScene === this.sceneKey
    );
    const sceneAgentIds = new Set(sceneAgentData.map((agent) => agent.id));

    this.agents.forEach((entity, agentId) => {
      if (!sceneAgentIds.has(agentId)) {
        entity.destroy();
        this.agents.delete(agentId);
      }
    });

    sceneAgentData.forEach((agentData) => {
      if (!this.agents.has(agentData.id)) {
        const newAgent = new AgentEntity(this, agentData);
        this.agents.set(agentData.id, newAgent);
        this.agentsGroup.add(newAgent);
      } else {
        this.agents.get(agentData.id)?.syncAgentData(agentData);
      }
    });
  }

  protected setupCollisions() {
    // 1. Player cannot walk through agents
    this.physics.add.collider(this.player, this.agentsGroup);

    // 2. Agents cannot walk through other agents
    this.physics.add.collider(this.agentsGroup, this.agentsGroup);

    // 3. Player and agents collide with solid structures and obstacles
    this.physics.add.collider(this.player, this.solidGroup);
    this.physics.add.collider(this.agentsGroup, this.solidGroup);
  }

  protected setupCamera() {
    this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    const viewport = this.scale.gameSize;
    const coverZoom = Math.max(viewport.width / this.mapWidth, viewport.height / this.mapHeight);
    this.cameras.main.setZoom(Math.max(0.85, coverZoom * 1.2));

    // CRITICAL FIX: Disable mouse wheel zoom completely!
    // No wheel event listeners are registered to change zoom.
    this.input.mouse?.disableContextMenu();
  }

  protected setupAtmosphereAndVFX() {
    const theme = this.sceneTheme[this.sceneKey];
    // Atmospheric Weather Overlay
    this.weatherOverlay = this.add.rectangle(
      this.mapWidth / 2,
      this.mapHeight / 2,
      this.mapWidth,
      this.mapHeight,
      theme.tint,
      0.1
    );
    this.weatherOverlay.setAlpha(0.06);
    this.weatherOverlay.setDepth(9999);

    // District Ambient Particles
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(3, 3, 3);
    graphics.generateTexture(`particle_${this.sceneKey}`, 6, 6);
    graphics.destroy();

    this.particleEmitter = this.add.particles(this.mapWidth / 2, this.mapHeight / 2, `particle_${this.sceneKey}`, {
      speed: { min: 8, max: 25 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 3500,
      frequency: 220,
      tint: theme.particleTint,
    });
    this.particleEmitter.setDepth(9000);

    const initialWeather = useGameStore.getState().world.weather;
    this.updateWeatherVFX(initialWeather);
  }

  private showAreaEntry(fromScene?: SceneKey) {
    const areaNames: Record<SceneKey, string> = {
      SanctuaryScene: 'Umega Sanctuary',
      OracleBasinScene: 'Oracle Basin',
      BotanistGroveScene: 'Botanist Grove',
      GrandForgeScene: 'Grand Forge',
      BardsAmphitheatreScene: "Bard's Amphitheatre",
      FrayingMarchScene: 'Fraying March',
      OuterWastesScene: 'Outer Wastes',
    };
    const entry = this.add.text(this.scale.gameSize.width / 2, 84, areaNames[this.sceneKey], {
      fontSize: '24px',
      fontFamily: 'Cinzel, Georgia, serif',
      color: '#ffffff',
      stroke: '#020617',
      strokeThickness: 5,
      backgroundColor: '#020617aa',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10000).setAlpha(fromScene ? 0 : 1);
    this.tweens.add({ targets: entry, alpha: 1, duration: 250, hold: 1100, yoyo: true, onComplete: () => entry.destroy() });
  }

  protected subscribeToStore() {
    let lastChar = useGameStore.getState().player.characterId;
    let lastWeather = useGameStore.getState().world.weather;

    this.unsubscribeStore = useGameStore.subscribe((state, prevState) => {
      if (!this.sys.settings.active || !this.player?.active) return;

      // 1. Character Avatar transmutation
      if (state.player.characterId !== lastChar) {
        lastChar = state.player.characterId;
        this.player.setCharacter(lastChar);
      }

      // 2. Weather change
      if (state.world.weather !== lastWeather) {
        lastWeather = state.world.weather;
        this.updateWeatherVFX(lastWeather);
      }

      // 3. Reconcile agents entering, leaving, or becoming the player.
      this.syncSceneAgents(state);
      this.renderBuiltStructures();

      // 4. Visual resonance pulse on chronicle enactment
      if (state.world.chronicles.length > prevState.world.chronicles.length) {
        this.cameras.main.flash(700, 56, 189, 248);
        if (this.particleEmitter && this.player) {
          this.particleEmitter.explode(35, this.player.x, this.player.y);
        }
      }
    });
  }

  private cleanupScene() {
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = undefined;
    }
  }

  protected updateWeatherVFX(weather: WeatherType) {
    if (!this.weatherOverlay) return;
    if (weather === 'aether_storm') {
      this.weatherOverlay.setFillStyle(0x3b0764);
      this.weatherOverlay.setAlpha(0.2);
      this.cameras.main.shake(350, 0.003);
    } else if (weather === 'aurora') {
      this.weatherOverlay.setFillStyle(0x064e3b);
      this.weatherOverlay.setAlpha(0.16);
    } else if (weather === 'golden_hour') {
      this.weatherOverlay.setFillStyle(0x78350f);
      this.weatherOverlay.setAlpha(0.14);
    } else if (weather === 'eclipse') {
      this.weatherOverlay.setFillStyle(0x020617);
      this.weatherOverlay.setAlpha(0.3);
    } else {
      this.weatherOverlay.setFillStyle(this.sceneTheme[this.sceneKey].tint);
      this.weatherOverlay.setAlpha(0.06);
    }
  }

  update(time: number, delta: number) {
    if (this.player) {
      this.player.update(time, delta);

      // Proximity check for closest agent to trigger Ubisoft-style prompt
      let closestAgent: AgentEntity | null = null;
      let minDistance = 95;

      this.agents.forEach((agent) => {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, agent.x, agent.y);
        if (dist < minDistance) {
          minDistance = dist;
          closestAgent = agent;
        }
      });

      const currentNearby = useGameStore.getState().nearbyAgent;
      if (closestAgent) {
        const agentData = (closestAgent as AgentEntity).agentData;
        if (currentNearby?.id !== agentData.id) {
          useGameStore.getState().setNearbyAgent(agentData);
        }
      } else if (currentNearby) {
        useGameStore.getState().setNearbyAgent(null);
      }
    }

    this.agents.forEach((agent) => {
      agent.update(time, delta);
    });
  }

  destroy() {
    this.cleanupScene();
  }
}
