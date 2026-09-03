import Phaser from 'phaser';
import { AnimationManager } from '../managers/AnimationManager';
import { CharacterId } from '../../types/game';
import { audioManager } from '../../services/AudioManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    let loadingArtwork: Phaser.GameObjects.Image | undefined;

    const fitLoadingArtwork = () => {
      if (!loadingArtwork) return;
      const viewportWidth = this.scale.gameSize.width;
      const viewportHeight = this.scale.gameSize.height;
      const containScale = Math.min(viewportWidth / loadingArtwork.width, viewportHeight / loadingArtwork.height);
      loadingArtwork.setPosition(viewportWidth / 2, viewportHeight / 2);
      loadingArtwork.setDisplaySize(
        loadingArtwork.width * containScale,
        loadingArtwork.height * containScale,
      );
    };

    this.load.once('filecomplete-image-loading-screen', () => {
      loadingArtwork = this.add.image(width / 2, height / 2, 'loading-screen')
        .setOrigin(0.5)
        .setDepth(0);
      fitLoadingArtwork();
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, fitLoadingArtwork, this);

    const progressBox = this.add.graphics();
    progressBox.setDepth(10);

    const progressBar = this.add.graphics();
    progressBar.setDepth(11);

    const loadingText = this.add.text(width / 2, height / 2 - 40, 'Forging Umega Reality Fabric...', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '16px',
      color: '#f8fafc',
      stroke: '#020617',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5);
    loadingText.setDepth(12);

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#020617',
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5);
    percentText.setDepth(12);

    const layoutProgress = () => {
      const viewportWidth = this.scale.gameSize.width;
      const viewportHeight = this.scale.gameSize.height;
      const barWidth = Math.min(520, Math.max(140, viewportWidth - 32));
      const barHeight = 24;
      const barX = (viewportWidth - barWidth) / 2;
      const barY = Math.max(48, Math.min(viewportHeight - 58, viewportHeight * 0.78));

      progressBox.clear();
      progressBox.fillStyle(0x020617, 0.88);
      progressBox.fillRoundedRect(barX - 18, barY - 52, barWidth + 36, 94, 12);
      progressBox.lineStyle(2, 0x67e8f9, 0.85);
      progressBox.strokeRoundedRect(barX - 18, barY - 52, barWidth + 36, 94, 12);

      progressBar.clear();
      progressBar.fillStyle(0x22d3ee, 1);
      progressBar.fillRoundedRect(barX, barY, barWidth, barHeight, 7);
      loadingText.setPosition(viewportWidth / 2, barY - 30);
      percentText.setPosition(viewportWidth / 2, barY + barHeight / 2);
    };

    layoutProgress();
    this.scale.on(Phaser.Scale.Events.RESIZE, layoutProgress, this);

    this.load.on('progress', (value: number) => {
      const viewportWidth = this.scale.gameSize.width;
      const viewportHeight = this.scale.gameSize.height;
      const barWidth = Math.min(520, Math.max(140, viewportWidth - 32));
      const barHeight = 24;
      const barX = (viewportWidth - barWidth) / 2;
      const barY = Math.max(48, Math.min(viewportHeight - 58, viewportHeight * 0.78));
      progressBar.clear();
      progressBar.fillStyle(0x22d3ee, 1);
      progressBar.fillRoundedRect(barX, barY, barWidth * value, barHeight, 7);
      percentText.setText(`${Math.floor(value * 100)}%`);
    });

    this.load.on('complete', () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, fitLoadingArtwork, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, layoutProgress, this);
      loadingArtwork?.destroy();
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    this.load.image('loading-screen', '/loading-screen.png');

    // 2. Preload Map Tiles and Props
    this.load.image('tile_cobble', '/tiles/cobble.png');
    this.load.image('tile_grass', '/tiles/grass.png');
    this.load.image('tile_water', '/tiles/water.png');
    this.load.image('prop_monument', '/tiles/monument.png');

    // 3. Preload District Environments (Backgrounds & Tiles)
    const envPrefixes = ['sanctuary', 'oracle', 'grove', 'forge', 'amphitheatre', 'march'];
    const envBgs: Record<string, string> = {
      sanctuary: '/environment/sanctuary_bg.png',
      oracle: '/environment/oracle_basin_bg.png',
      grove: '/environment/botanist_grove_bg.png',
      forge: '/environment/grand_forge_bg.png',
      amphitheatre: '/environment/bards_amphitheatre_bg.png',
      march: '/environment/fraying_march_bg.png',
    };

    envPrefixes.forEach((env) => {
      this.load.image(`env_bg_${env}`, envBgs[env]);
      this.load.image(`tile_cobble_${env}`, `/environment/${env === 'oracle' ? 'oracle' : env === 'grove' ? 'grove' : env === 'forge' ? 'forge' : env === 'amphitheatre' ? 'amphitheatre' : env === 'march' ? 'march' : 'sanctuary'}_cobble.png`);
      this.load.image(`tile_grass_${env}`, `/environment/${env === 'oracle' ? 'oracle' : env === 'grove' ? 'grove' : env === 'forge' ? 'forge' : env === 'amphitheatre' ? 'amphitheatre' : env === 'march' ? 'march' : 'sanctuary'}_grass.png`);
      this.load.image(`tile_water_${env}`, `/environment/${env === 'oracle' ? 'oracle' : env === 'grove' ? 'grove' : env === 'forge' ? 'forge' : env === 'amphitheatre' ? 'amphitheatre' : env === 'march' ? 'march' : 'sanctuary'}_water.png`);
    });

    // Special Environment Features
    this.load.image('env_city_plaza', '/environment/city_plaza.png');
    this.load.image('env_stone_pathway', '/environment/stone_pathway.jpg');
    this.load.image('env_heaven', '/environment/heaven.jpg');
    this.load.image('env_mystical_garden', '/environment/mystical_garden.png');
    this.load.image('env_outer', '/environment/outer.png');
    this.load.image('env_clifs', '/environment/clifs.png');

    // 4. Preload Buildings
    const buildings = [
      'story_spire', 'council_hall', 'shrine', 'modular_house_a', 'modular_house_b',
      'living_library', 'builder_workshop', 'ancient_gate', 'chronicle_vault',
      'biomancer_lab', 'magma_furnace', 'star_smelter', 'echo_pavilion', 'bard_academy'
    ];
    buildings.forEach((b) => {
      this.load.image(`bld_${b}`, `/buildings/${b}.png`);
    });

    // 5. Preload Props & Portals
    const props = [
      'story_stone', 'law_tablet', 'story_lantern', 'simple_bench', 'pathway_marker',
      'ground_node', 'banner', 'memory_crystal', 'communication_orb', 'builder_modular',
      'portal_gate_cyan', 'portal_gate_purple', 'portal_gate_green',
      'portal_gate_orange', 'portal_gate_rose', 'portal_gate_teal',
      'street_lamp', 'tree_willow', 'tree_crystal', 'arcane_fountain',
      'rune_stone', 'forge_anvil'
    ];
    props.forEach((p) => {
      this.load.image(`prop_${p}`, `/props/${p}.png`);
    });

    // 6. Preload all supported character frame sequences
    const characters: CharacterId[] = [
      'aelira',
      'torren',
      'kaelen',
      'veyra',
      'orthas',
      'sylis',
      'lira',
      'elder_maelon',
      'vance',
    ];

    characters.forEach((charId) => {
      AnimationManager.preloadCharacter(this, charId);
    });
  }

  create() {
    // Register all character animation keys into the Phaser Animation Registry
    const animManager = new AnimationManager(this);
    const characters: CharacterId[] = [
      'aelira',
      'torren',
      'kaelen',
      'veyra',
      'orthas',
      'sylis',
      'lira',
      'elder_maelon',
      'vance',
    ];

    characters.forEach((charId) => {
      animManager.createCharacterAnimations(charId);
    });

    // Transition to the Sanctuary Scene
    this.scene.start('SanctuaryScene');
    audioManager.start();
  }
}
