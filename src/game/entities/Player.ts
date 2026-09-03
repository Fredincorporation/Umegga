import Phaser from 'phaser';
import { CharacterId, AnimationType } from '../../types/game';
import { AnimationManager } from '../managers/AnimationManager';
import { useGameStore } from '../../store/useGameStore';
import { SUPPORTED_CHARACTERS } from '../../constants/characters';

export class Player extends Phaser.GameObjects.Container {
  public sprite: Phaser.GameObjects.Sprite;
  private nameText: Phaser.GameObjects.Text;
  private auraCircle: Phaser.GameObjects.Arc;
  private shadowEllipse: Phaser.GameObjects.Ellipse;
  public characterId: CharacterId;
  public lastFacingLeft = false;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private interactKey?: Phaser.Input.Keyboard.Key;

  private currentAnimType: AnimationType = 'idle';
  private baseSpeed = 165;
  private lastSyncTime = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, characterId: CharacterId = 'aelira') {
    super(scene, x, y);
    this.characterId = characterId;
    this.baseSpeed = SUPPORTED_CHARACTERS[characterId]?.baseSpeed || 165;

    // 1. Soft Shadow under the player
    this.shadowEllipse = scene.add.ellipse(0, 16, 26, 12, 0x000000, 0.45);
    this.add(this.shadowEllipse);

    // 2. Arcane Aura ring under the player
    this.auraCircle = scene.add.circle(0, 16, 18, 0x38bdf8, 0.25);
    this.add(this.auraCircle);

    // 3. Main Animated Sprite
    const initialFrameKey = `${characterId}_idle_001`;
    this.sprite = scene.add.sprite(0, 0, initialFrameKey);
    const playerSource = this.sprite.texture.getSourceImage() as HTMLImageElement;
    this.sprite.setScale(Math.min(76 / (playerSource.width || this.sprite.width), 96 / (playerSource.height || this.sprite.height)));
    this.sprite.setOrigin(0.5, 0.7);
    this.add(this.sprite);

    // 4. Floating Name Label
    this.nameText = scene.add.text(0, -32, `You (${SUPPORTED_CHARACTERS[characterId]?.name || characterId})`, {
      fontSize: '11px',
      fontFamily: 'Inter, sans-serif',
      color: '#ffffff',
      backgroundColor: '#0f172aee',
      padding: { x: 6, y: 2 },
    }).setOrigin(0.5, 0.5);
    this.add(this.nameText);

    // 5. Enable Arcade Physics on this container
    scene.physics.world.enable(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 22);
    body.setOffset(-11, 4);
    body.setCollideWorldBounds(true);

    // 6. Setup Keyboard Inputs (WASD + Arrows + E for Interact)
    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasdKeys = scene.input.keyboard.addKeys({
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D,
      }) as any;
      this.interactKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    }

    // Play default idle animation
    AnimationManager.playAnim(this.sprite, this.characterId, 'idle');
    this.setDepth(this.y);

    scene.add.existing(this);
  }

  /**
   * Transmutes the player's character avatar
   */
  public setCharacter(newCharId: CharacterId) {
    if (!this.active || !this.scene.sys.settings.active) return;
    const character = SUPPORTED_CHARACTERS[newCharId];
    this.baseSpeed = character?.baseSpeed || 165;
    if (this.characterId === newCharId) {
      this.nameText.setText(`You (${character?.name || newCharId})`);
      return;
    }
    this.characterId = newCharId;
    const frameKey = `${newCharId}_idle_001`;
    const nextAnimation = `${newCharId}_${this.currentAnimType}`;

    this.nameText.setText(`You (${character?.name || newCharId})`);
    this.sprite.setTexture(frameKey);
    this.sprite.setFlipX(this.lastFacingLeft);
    AnimationManager.playAnim(this.sprite, newCharId, this.currentAnimType);

    if (!this.sprite.scene.anims.exists(nextAnimation)) {
      AnimationManager.playAnim(this.sprite, newCharId, 'idle');
    }
  }

  /**
   * Update cycle for Player (called in scene update)
   */
  public update(time: number, _delta: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    const state = useGameStore.getState();

    // Agent chat is modal: keyboard controls belong to the chat until it closes.
    if (state.activePanel === 'agent_inspector' || state.engagedAgentId) {
      body.setVelocity(0, 0);
      if (this.currentAnimType !== 'idle') {
        this.currentAnimType = 'idle';
        AnimationManager.playAnim(this.sprite, this.characterId, 'idle');
      }
      return;
    }

    // Check interaction key 'E' only when no agent chat is open.
    if (this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      const nearby = state.nearbyAgent;
      if (nearby) {
        const nearbyEntity = (this.scene as any).agents?.get(nearby.id);
        if (nearbyEntity) {
          nearbyEntity.isEngagedWithPlayer = true;
          nearbyEntity.showThought(nearby.personality?.playerAttitude || 'I am listening, traveler.', 4000);
          AnimationManager.playAnim(nearbyEntity.sprite, nearbyEntity.characterId, 'talk');
        }
        state.interactWithNearbyAgent();
      }
    }

    let vx = 0;
    let vy = 0;

    // Check Arrow Keys & WASD
    const left = this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown;
    const right = this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown;
    const up = this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown;
    const down = this.cursors?.down?.isDown || this.wasdKeys?.S?.isDown;

    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;

    // Normalize diagonal velocity
    if (vx !== 0 && vy !== 0) {
      vx *= 0.7071;
      vy *= 0.7071;
    }

    // Apply speed modifiers from active laws in Zustand
    const worldLaws = useGameStore.getState().world.activeLaws;
    let speedMultiplier = 1.0;
    worldLaws.forEach((law) => {
      if (law.active && law.effect.type === 'speed_boost') {
        speedMultiplier *= law.effect.magnitude;
      }
    });

    const currentSpeed = this.baseSpeed * speedMultiplier;
    body.setVelocity(vx * currentSpeed, vy * currentSpeed);

    const isMoving = vx !== 0 || vy !== 0;
    const targetAnim: AnimationType = isMoving ? 'walk' : 'idle';

    // Flip sprite horizontal facing based on 4-directional movement
    if (vx < 0) {
      this.lastFacingLeft = true;
      this.sprite.setFlipX(true);
    } else if (vx > 0) {
      this.lastFacingLeft = false;
      this.sprite.setFlipX(false);
    } else {
      // Vertical movement keeps the last horizontal facing until directional frames exist.
      this.sprite.setFlipX(this.lastFacingLeft);
    }

    // Update animation state
    if (targetAnim !== this.currentAnimType) {
      this.currentAnimType = targetAnim;
      AnimationManager.playAnim(this.sprite, this.characterId, targetAnim);
    }

    // 2.5D Depth sorting & perspective scaling
    this.setDepth(this.y);
    const sceneHeight = this.scene.physics.world.bounds.height || 1200;
    const perspectiveScale = Phaser.Math.Clamp(0.92 + (this.y / sceneHeight) * 0.18, 0.92, 1.1);
    this.setScale(perspectiveScale);

    // Subtle breathing pulse for aura
    this.auraCircle.setScale(1 + Math.sin(time / 300) * 0.1);

    // Sync position with Zustand store throttle (every 60ms)
    if (time - this.lastSyncTime > 60) {
      this.lastSyncTime = time;
      useGameStore.getState().updatePlayerPosition(this.x, this.y, this.currentAnimType, isMoving);
    }
  }

  
}
