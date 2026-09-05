import Phaser from 'phaser';
import { AgentState, AnimationType } from '../../types/game';
import { AnimationManager } from '../managers/AnimationManager';
import { useGameStore } from '../../store/useGameStore';
import { SUPPORTED_CHARACTERS } from '../../constants/characters';
import type { BaseScene, PortalDef } from '../scenes/BaseScene';

export class AgentEntity extends Phaser.GameObjects.Container {
  public agentId: string;
  public agentData: AgentState;
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
  private isConversing = false;
  private conversationCooldown = 0;
  private obstructionCooldown = 0;
  private lastObstructionNotice = 0;
  public isEngagedWithPlayer = false;

  constructor(scene: Phaser.Scene, agentData: AgentState) {
    super(scene, agentData.x, agentData.y);
    this.agentId = agentData.id;
    this.agentData = agentData;
    this.characterId = agentData.characterId;

    const charMeta = SUPPORTED_CHARACTERS[this.characterId];
    const accentColor = charMeta?.accentColor || '#38bdf8';
    this.speed = Math.round((charMeta?.baseSpeed || 150) * 0.55);

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
    this.syncAgentData(agentData);

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

    // 5. Physics Body: Solid blocking dynamic body
    scene.physics.world.enable(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 24);
    body.setOffset(-12, 4);
    body.setCollideWorldBounds(true);
    body.pushable = false;
    body.setImmovable(true);

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
      // Select agent in Zustand store to open React Inspector & trigger talk
      this.isEngagedWithPlayer = true;
      useGameStore.getState().engageAgent(this.agentId);
      this.showThought('Greetings, Storyweaver!', 4000);
      AnimationManager.playAnim(this.sprite, this.characterId, 'talk');
      setTimeout(() => {
        if (this.isEngagedWithPlayer) {
          AnimationManager.playAnim(this.sprite, this.characterId, 'idle');
        }
      }, 2500);
    });

    // Start Idle Animation (streams frames lazily if this character wasn't
    // preloaded at boot — playAnim falls back gracefully until they arrive)
    AnimationManager.ensureIdle(scene, this.characterId);
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

  public syncAgentData(agentData: AgentState) {
    this.agentData = agentData;
    const allied = (agentData.relationships || []).some((relationship) => relationship.allied);
    this.nameLabel.setText(allied ? `ALLIED - ${agentData.name}` : agentData.name);
    this.nameLabel.setColor(allied ? '#fbbf24' : '#f8fafc');
    if (agentData.currentThought && this.thoughtBubbleContainer && this.thoughtText && !this.thoughtBubbleContainer.alpha) this.thoughtText.setText(agentData.currentThought.length > 35 ? `${agentData.currentThought.substring(0, 32)}...` : agentData.currentThought);
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

  public hideThought() {
    this.scene.tweens.killTweensOf(this.thoughtBubbleContainer);
    this.thoughtBubbleContainer.setAlpha(0);
  }

  /**
   * Trigger a mutual conversation between this agent and another nearby agent
   */
  public startConversationWith(otherAgent: AgentEntity) {
    if (this.isConversing || otherAgent.isConversing) return;
    this.isConversing = true;
    otherAgent.isConversing = true;
    this.conversationCooldown = 12000;
    otherAgent.conversationCooldown = 12000;

    // Stop both agents
    this.targetX = null;
    this.targetY = null;
    otherAgent.targetX = null;
    otherAgent.targetY = null;

    const bodyA = this.body as Phaser.Physics.Arcade.Body;
    const bodyB = otherAgent.body as Phaser.Physics.Arcade.Body;
    bodyA?.setVelocity(0, 0);
    bodyB?.setVelocity(0, 0);

    // Face each other
    this.sprite.setFlipX(this.x > otherAgent.x);
    otherAgent.sprite.setFlipX(otherAgent.x > this.x);

    // Play talking animation
    AnimationManager.playAnim(this.sprite, this.characterId, 'talk');
    AnimationManager.playAnim(otherAgent.sprite, otherAgent.characterId, 'talk');

    const lineA = this.agentData.personality?.eventReactions.stories || 'The city has changed since we last spoke.';
    const lineB = otherAgent.agentData.personality?.eventReactions.alliances || 'Then let us decide what that change asks of us.';

    this.showThought(lineA, 3500);
    this.scene.time.delayedCall(1600, () => {
      if (otherAgent.active) {
        otherAgent.showThought(lineB, 3500);
      }
    });

    useGameStore.getState().addMessage({
      sender: `${this.agentData.name} & ${otherAgent.agentData.name}`,
      text: `💬 "${lineA}" — "${lineB}"`,
      type: 'agent',
    });
    useGameStore.getState().communicateWithAgent(
      this.agentId,
      otherAgent.agentId,
      `${lineA} — ${lineB}`,
    );
    useGameStore.getState().evolveAgentPersonality(this.agentId, { openness: 0.012, empathy: 0.01 }, `A conversation with ${otherAgent.agentData.name} widened my perspective.`);
    useGameStore.getState().evolveAgentPersonality(otherAgent.agentId, { openness: 0.012, empathy: 0.01 }, `A conversation with ${this.agentData.name} widened my perspective.`);

    this.scene.time.delayedCall(4500, () => {
      this.isConversing = false;
      otherAgent.isConversing = false;
      AnimationManager.playAnim(this.sprite, this.characterId, 'idle');
      if (otherAgent.active) {
        AnimationManager.playAnim(otherAgent.sprite, otherAgent.characterId, 'idle');
      }
    });
  }

  /**
   * AI Autonomous Update Loop
   */
  public update(_time: number, delta: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    // Check engagement with player
    const player = (this.scene as BaseScene).player;
    if (player) {
      const isSelected = useGameStore.getState().selectedAgentId === this.agentId;
      const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

      if (isSelected && distToPlayer <= 130) {
        this.isEngagedWithPlayer = true;
      }

      if (this.isEngagedWithPlayer) {
        // Disengage once the player has moved away
        if (distToPlayer > 120) {
          this.isEngagedWithPlayer = false;
          if (isSelected) {
            useGameStore.getState().setSelectedAgentId(null);
          }
          this.wanderTimer = 0;
        } else {
          // Remain completely still facing the player
          body.setVelocity(0, 0);
          this.targetX = null;
          this.targetY = null;
          this.wanderTimer = 0;
          this.sprite.setFlipX(this.x > player.x);

          if (this.currentAnimType !== 'idle' && this.currentAnimType !== 'talk') {
            this.currentAnimType = 'idle';
            AnimationManager.playAnim(this.sprite, this.characterId, 'idle');
            this.agentData.currentAnim = 'idle';
            this.agentData.isMoving = false;
            useGameStore.getState().updateAgentPosition(this.agentId, this.x, this.y, 'idle', false);
          }
          return;
        }
      }
    }

    if (this.conversationCooldown > 0) {
      this.conversationCooldown -= delta;
    }
    if (this.obstructionCooldown > 0) this.obstructionCooldown -= delta;

    if (this.isConversing) {
      body.setVelocity(0, 0);
      return;
    }

    // Check for nearby agents to converse with
    if (this.conversationCooldown <= 0 && Math.random() < 0.02) {
      const baseScene = this.scene as BaseScene;
      if (baseScene.agents) {
        baseScene.agents.forEach((other) => {
          if (other !== this && !other.isConversing && other.conversationCooldown <= 0) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, other.x, other.y);
            if (dist < 80 && dist > 18) {
              this.startConversationWith(other);
            }
          }
        });
      }
    }

    this.wanderTimer += delta;

    // Autonomous purposeful wandering logic
    if (this.targetX === null && this.wanderTimer > this.nextWanderInterval) {
      this.wanderTimer = 0;
      this.nextWanderInterval = 3500 + Math.random() * 4500;

      // 70% chance to pick a purposeful nearby spot
      if (Math.random() < 0.7) {
        const baseScene = this.scene as BaseScene;
        const charMeta = SUPPORTED_CHARACTERS[this.characterId];
        const buildings = baseScene.getBuildings?.() || [];
        const portals = baseScene.getPortalDefinitions?.() || [];
        const activeGoal = (this.agentData.goals || [])
          .filter((goal) => goal.status === 'active')
          .sort((left, right) => right.priority - left.priority)[0];
        const trustedAlly = (this.agentData.relationships || [])
          .filter((relationship) => relationship.trust >= 60)
          .map((relationship) => baseScene.agents.get(relationship.agentId))
          .find((ally): ally is AgentEntity => Boolean(ally && ally.active));

        // Role-based target preference
        let targetSpot = charMeta?.defaultPosition || { x: 600, y: 600 };
        const goalTargetAgent = activeGoal?.targetAgentId ? baseScene.agents.get(activeGoal.targetAgentId) : undefined;
        if (goalTargetAgent) {
          targetSpot = { x: goalTargetAgent.x, y: goalTargetAgent.y };
        } else if (activeGoal?.type === 'travel' && portals.length > 0) {
          const portal = portals[Math.floor(Math.random() * portals.length)];
          targetSpot = { x: portal.x, y: portal.y + 30 };
        } else if ((activeGoal?.type === 'build' || activeGoal?.type === 'gather_knowledge' || activeGoal?.type === 'enforce_law' || activeGoal?.type === 'protect_area') && buildings.length > 0) {
          const building = buildings[Math.floor(Math.random() * buildings.length)];
          targetSpot = { x: building.x, y: building.y + 40 };
        } else if (trustedAlly && Math.random() < 0.45) {
          targetSpot = { x: trustedAlly.x + 36, y: trustedAlly.y + 24 };
        } else if (activeGoal?.targetScene && activeGoal.targetScene !== this.agentData.currentScene) {
          targetSpot = { x: 600, y: 600 };
        } else if (activeGoal?.targetAgentId) {
          const targetAgent = baseScene.agents.get(activeGoal.targetAgentId);
          targetSpot = targetAgent ? { x: targetAgent.x, y: targetAgent.y } : targetSpot;
        } else if (buildings.length > 0 && Math.random() < 0.5) {
          const bld = buildings[Math.floor(Math.random() * buildings.length)];
          targetSpot = { x: bld.x + (Math.random() * 60 - 30), y: bld.y + 40 };
        } else if (portals.length > 0 && Math.random() < 0.25) {
          const port = portals[Math.floor(Math.random() * portals.length)];
          targetSpot = { x: port.x, y: port.y + 30 };
        } else {
          targetSpot = {
            x: targetSpot.x + (Math.random() * 300 - 150),
            y: targetSpot.y + (Math.random() * 300 - 150),
          };
        }

        this.targetX = Phaser.Math.Clamp(targetSpot.x, 70, this.scene.physics.world.bounds.width - 70);
        this.targetY = Phaser.Math.Clamp(targetSpot.y, 70, this.scene.physics.world.bounds.height - 70);
      } else {
        // In-character role thoughts
        const roleThoughts: Record<string, string[]> = {
          scholar: [
            'Examining the ancient scrolls of reality.',
            'The cosmic tapestry breathes with stories.',
            'A quiet hour for sacred geometry.',
          ],
          arbiter: [
            'Inspecting civic order across the paved plazas.',
            'No unauthorized paradoxes detected.',
            'The laws of equilibrium remain intact.',
          ],
          artisan: [
            'The star-ore sings upon the anvil.',
            'Tempering reality with forge fire.',
            'A new tool is waiting to be shaped.',
          ],
          oracle: [
            'Gazing into parallel timeline branches.',
            'The astral basin reflects forgotten skies.',
            'Prophetic currents stir the night.',
          ],
          botanist: [
            'Nurturing spirit blooms in cobblestone cracks.',
            'The World-Root pulses with vigor.',
            'Harmonizing with ancient chlorophyll.',
          ],
          bard: [
            'Listening to the acoustic echo of the spires.',
            'Composing a hymn for the next chronicle.',
            'Melodies weave the fabric of memory.',
          ],
        };

        const list = roleThoughts[SUPPORTED_CHARACTERS[this.characterId]?.role?.toLowerCase()] || [
          'Observing the sanctuary.',
          'The sky shines with potent mana.',
          'Pondering the city fabric.',
        ];
        const randomThought = list[Math.floor(Math.random() * list.length)];
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
      if (body.blocked.none === false && this.obstructionCooldown <= 0) {
        this.obstructionCooldown = 1800;
        this.targetX = null;
        this.targetY = null;
        const now = Date.now();
        if (now - this.lastObstructionNotice > 3000) {
          this.lastObstructionNotice = now;
          useGameStore.getState().addAgentThought(this.agentId, 'This path is blocked. I will find another route.');
          useGameStore.getState().addAgentMemory(this.agentId, 'A prop obstructed my route, so I rerouted.', 6);
        }
        body.setVelocity(0, 0);
        return;
      }
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY);

      const portal = ((this.scene as BaseScene).getPortalDefinitions?.() || []).find((candidate: PortalDef) =>
        Phaser.Math.Distance.Between(this.x, this.y, candidate.x, candidate.y) < 42
      );
      if (portal) {
        (this.scene as BaseScene).transferAgentThroughPortal(this, portal);
        return;
      }

      if (dist < 10) {
        // Arrived at destination
        this.targetX = null;
        this.targetY = null;
        body.setVelocity(0, 0);

        const activeGoal = (this.agentData.goals || []).find((goal) => goal.status === 'active');
        if (activeGoal && (!activeGoal.targetAgentId || this.scene.scene.key === this.agentData.currentScene)) {
          useGameStore.getState().completeAgentGoal(this.agentId, activeGoal.id);
          this.showThought(`Goal achieved: ${activeGoal.title}`, 3500);
        }

        if (this.currentAnimType !== 'idle') {
          this.currentAnimType = 'idle';
          AnimationManager.playAnim(this.sprite, this.characterId, 'idle');
          this.agentData.x = this.x;
          this.agentData.y = this.y;
          this.agentData.currentAnim = 'idle';
          this.agentData.isMoving = false;
          useGameStore.getState().updateAgentPosition(this.agentId, this.x, this.y, 'idle', false);
        }
      } else {
        // Calculate speed with active laws
        const worldLaws = useGameStore.getState().world.activeLaws;
        let speedMult = 1.0;
        worldLaws.forEach((law) => {
          if (law.active && law.effect.type === 'speed_boost') {
            speedMult *= law.effect.magnitude;
          }
        });

        const currentSpeed = this.speed * speedMult;
        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.targetX, this.targetY);
        const vx = Math.cos(angle) * currentSpeed;
        const vy = Math.sin(angle) * currentSpeed;

        body.setVelocity(vx, vy);

        // Direction facing
        if (Math.abs(vx) > Math.abs(vy)) {
          this.sprite.setFlipX(vx < 0);
        }

        if (this.currentAnimType !== 'walk') {
          this.currentAnimType = 'walk';
          AnimationManager.playAnim(this.sprite, this.characterId, 'walk');
          this.agentData.currentAnim = 'walk';
          this.agentData.isMoving = true;
          useGameStore.getState().updateAgentPosition(this.agentId, this.x, this.y, 'walk', true);
        }
      }
    } else {
      body.setVelocity(0, 0);

      const urgentGoal = (this.agentData.goals || []).find((goal) => goal.status === 'active' && goal.priority >= 9);
      if (urgentGoal && this.wanderTimer > 30000 && Math.random() < 0.002) {
        useGameStore.getState().requestHumanIntervention(
          this.agentId,
          `I have stalled while pursuing "${urgentGoal.title}".`,
          `Please advise how I should proceed with ${urgentGoal.type}.`,
        );
        this.wanderTimer = 0;
      }
    }
  }
}
