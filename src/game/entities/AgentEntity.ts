import Phaser from 'phaser';
import { AgentState, AnimationType } from '../../types/game';
import { AnimationManager } from '../managers/AnimationManager';
import { useGameStore } from '../../store/useGameStore';
import { SUPPORTED_CHARACTERS } from '../../constants/characters';
import type { BaseScene, PortalDef } from '../scenes/BaseScene';

export class AgentEntity extends Phaser.GameObjects.Container {
  public agentId: string;
  public sprite: Phaser.GameObjects.Sprite;
  private nameLabel: Phaser.GameObjects.Text;
  private thoughtBubbleContainer: Phaser.GameObjects.Container;
  private thoughtText: Phaser.GameObjects.Text;

  private targetX: number | null = null;
  private targetY: number | null = null;
  private wanderTimer = 0;
  private nextWanderInterval = 4000;
  private speed = 75;
  private currentAnimType: AnimationType = 'idle';
  public characterId: AgentState['characterId'];

  constructor(scene: Phaser.Scene, agentData: AgentState) {
    super(scene, agentData.x, agentData.y);
    this.agentId = agentData.id;
    this.characterId = agentData.characterId;

    const charMeta = SUPPORTED_CHARACTERS[this.characterId];
    const accentColor = charMeta?.accentColor || '#38bdf8';

    // 1. Soft Shadow / Base
    const shadow = scene.add.ellipse(0, 16, 26, 12, 0x000000, 0.4);
    this.add(shadow);

    // 2. Main Animated Sprite
    const frameKey = `${this.characterId}_idle_001`;
    this.sprite = scene.add.sprite(0, 0, frameKey);
    const agentSource = this.sprite.texture.getSourceImage() as HTMLImageElement;
    this.sprite.setScale(Math.min(76 / (agentSource.width || this.sprite.width), 96 / (agentSource.height || this.sprite.height)));
    this.sprite.setOrigin(0.5, 0.7);
    this.add(this.sprite);

    // 3. Name & Role Tag
    this.nameLabel = scene.add.text(0, -32, `${agentData.name}`, {
      fontSize: '10px',
      fontFamily: 'Inter, sans-serif',
      color: '#f8fafc',
      backgroundColor: '#0f172acc',
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 0.5);
    this.add(this.nameLabel);

    // 4. Interactive Thought Bubble
    this.thoughtBubbleContainer = scene.add.container(0, -56);
    const bubbleBg = scene.add.graphics();
    bubbleBg.fillStyle(0x1e293b, 0.95);
    bubbleBg.fillRoundedRect(-70, -14, 140, 24, 6);
    bubbleBg.lineStyle(1, Phaser.Display.Color.HexStringToColor(accentColor).color, 0.8);
    bubbleBg.strokeRoundedRect(-70, -14, 140, 24, 6);

    this.thoughtText = scene.add.text(0, -2, agentData.currentThought || 'Observing...', {
      fontSize: '9px',
      fontFamily: 'Inter, sans-serif',
      color: '#e2e8f0',
      align: 'center',
      wordWrap: { width: 130 },
    }).setOrigin(0.5, 0.5);

    this.thoughtBubbleContainer.add([bubbleBg, this.thoughtText]);
    this.thoughtBubbleContainer.setAlpha(0); // Initially hidden, fades in on thought
    this.add(this.thoughtBubbleContainer);

    // 5. Physics Body
    scene.physics.world.enable(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(22, 22);
    body.setOffset(-11, 4);
    body.setCollideWorldBounds(true);
    body.setImmovable(false);
    body.setDamping(true);
    body.setDrag(0.001);

    // 6. Interactive Click / Hover
    this.setSize(32, 48);
    this.setInteractive(new Phaser.Geom.Rectangle(-16, -32, 32, 48), Phaser.Geom.Rectangle.Contains);

    this.on('pointerover', () => {
      this.sprite.setTint(0x7dd3fc);
      scene.input.setDefaultCursor('pointer');
      this.showThought(this.thoughtText.text, 3000);
    });

    this.on('pointerout', () => {
      this.sprite.clearTint();
      scene.input.setDefaultCursor('default');
    });

    this.on('pointerdown', () => {
      // Select agent in Zustand store to open React Inspector
      useGameStore.getState().setSelectedAgentId(this.agentId);
      this.showThought('Greetings, Storyweaver!', 4000);
      AnimationManager.playAnim(this.sprite, this.characterId, 'talk');
      setTimeout(() => {
        AnimationManager.playAnim(this.sprite, this.characterId, this.currentAnimType);
      }, 2000);
    });

    // Start Idle Animation
    AnimationManager.playAnim(this.sprite, this.characterId, 'idle');
    this.wanderTimer = Math.random() * 2000;
    this.setDepth(this.y);

    scene.add.existing(this);
  }

  /**
   * Set a specific destination for this agent (e.g. from MCP or click)
   */
  public setTargetDestination(x: number, y: number) {
    this.targetX = x;
    this.targetY = y;
  }

  /**
   * Display a floating thought bubble over the agent
   */
  public showThought(text: string, durationMs = 4000) {
    this.thoughtText.setText(text.length > 35 ? text.substring(0, 32) + '...' : text);
    this.scene.tweens.killTweensOf(this.thoughtBubbleContainer);
    this.scene.tweens.add({
      targets: this.thoughtBubbleContainer,
      alpha: 1,
      y: -60,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.time.delayedCall(durationMs, () => {
          this.scene.tweens.add({
            targets: this.thoughtBubbleContainer,
            alpha: 0,
            y: -56,
            duration: 400,
          });
        });
      },
    });
  }

  /**
   * AI Autonomous Update Loop
   */
  public update(_time: number, delta: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    this.wanderTimer += delta;

    // Autonomous wandering logic if no explicit target
    if (this.targetX === null && this.wanderTimer > this.nextWanderInterval) {
      this.wanderTimer = 0;
      this.nextWanderInterval = 3000 + Math.random() * 5000;

      // 60% chance to pick a nearby spot, 40% chance to stay idling
      if (Math.random() < 0.75) {
        const charMeta = SUPPORTED_CHARACTERS[this.characterId];
        const portals = (this.scene as BaseScene).getPortalDefinitions?.() || [];
        const portal = portals.length > 0 && Math.random() < 0.3
          ? portals[Math.floor(Math.random() * portals.length)]
          : null;
        const anchor = charMeta?.defaultPosition || { x: 400, y: 400 };
        const rx = portal?.x ?? anchor.x + (Math.random() * 420 - 210);
        const ry = portal?.y ?? anchor.y + (Math.random() * 420 - 210);
        this.targetX = Phaser.Math.Clamp(rx, 64, this.scene.physics.world.bounds.width - 64);
        this.targetY = Phaser.Math.Clamp(ry, 64, this.scene.physics.world.bounds.height - 64);
      } else {
        // Idling thoughts
        const thoughts = [
          'The sky shines with potent mana.',
          'Studying the ancient stones...',
          'A quiet moment in Umega.',
          'Formulating a new decree.',
          'Listening to the wind spires.',
        ];
        const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];
        this.showThought(randomThought, 3000);
      }
    }

    // 2.5D Depth sorting & perspective scaling
    this.setDepth(this.y);
    const sceneHeight = this.scene.physics.world.bounds.height || 1200;
    const perspectiveScale = Phaser.Math.Clamp(0.92 + (this.y / sceneHeight) * 0.18, 0.92, 1.1);
    this.setScale(perspectiveScale);

    // Moving towards target
    if (this.targetX !== null && this.targetY !== null) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY);

      const portal = ((this.scene as BaseScene).getPortalDefinitions?.() || []).find((candidate: PortalDef) =>
        Phaser.Math.Distance.Between(this.x, this.y, candidate.x, candidate.y) < 42
      );
      if (portal) {
        (this.scene as BaseScene).transferAgentThroughPortal(this, portal);
        return;
      }

      if (dist < 8) {
        // Arrived at destination
        this.targetX = null;
        this.targetY = null;
        body.setVelocity(0, 0);

        if (this.currentAnimType !== 'idle') {
          this.currentAnimType = 'idle';
          AnimationManager.playAnim(this.sprite, this.characterId, 'idle');
          useGameStore.getState().updateAgentPosition(this.agentId, this.x, this.y, 'idle', false);
        }
      } else {
        // Move towards target
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.targetX, this.targetY);
        const vx = Math.cos(angle) * this.speed;
        const vy = Math.sin(angle) * this.speed;

        body.setVelocity(vx, vy);

        // Direction facing
        if (Math.abs(vx) > Math.abs(vy)) {
          this.sprite.setFlipX(vx < 0);
        } else {
          this.sprite.setFlipX(this.sprite.flipX);
        }

        if (this.currentAnimType !== 'walk') {
          this.currentAnimType = 'walk';
          AnimationManager.playAnim(this.sprite, this.characterId, 'walk');
          useGameStore.getState().updateAgentPosition(this.agentId, this.x, this.y, 'walk', true);
        }
      }
    } else {
      body.setVelocity(0, 0);
    }
  }

  
}
