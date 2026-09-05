import Phaser from 'phaser';
import { CharacterId, AnimationType } from '../../types/game';
import { assetUrl } from '../../config/assets';

/**
 * Detailed Animation Frame Rules for each character and action.
 * Maps character IDs to their frame naming schemes and counts.
 */
export interface CharacterFrameScheme {
  idle: { prefix?: string; suffix?: string; pattern: 'auto' | 'numbered' | 'custom'; count: number; startIdx?: number; customFiles?: string[] };
  walk: { prefix?: string; suffix?: string; pattern: 'auto' | 'numbered' | 'custom'; count: number; startIdx?: number; customFiles?: string[] };
  talk: { prefix?: string; suffix?: string; pattern: 'auto' | 'numbered' | 'custom'; count: number; startIdx?: number; customFiles?: string[] };
}

export const CHARACTER_FRAME_MAP: Record<CharacterId, CharacterFrameScheme> = {
  aelira: {
    idle: { pattern: 'auto', count: 12 },
    walk: { pattern: 'auto', count: 12 },
    talk: { pattern: 'auto', count: 12 },
  },
  torren: {
    idle: { pattern: 'numbered', prefix: 'torren_idle', count: 12, startIdx: 0 },
    walk: { pattern: 'numbered', prefix: 'torren_walk', count: 12, startIdx: 0 },
    talk: { pattern: 'numbered', prefix: 'torren_work', count: 12, startIdx: 0 },
  },
  kaelen: {
    idle: { pattern: 'numbered', prefix: 'kealen_idle', count: 12, startIdx: 0 },
    walk: { pattern: 'numbered', prefix: 'kealen_walk', count: 12, startIdx: 0 },
    talk: { pattern: 'numbered', prefix: 'kealen_gesture', count: 12, startIdx: 0 },
  },
  veyra: {
    idle: { pattern: 'numbered', prefix: 'veyra_idle', count: 12, startIdx: 0 },
    walk: { pattern: 'numbered', prefix: 'veyra_walk', count: 12, startIdx: 0 },
    talk: { pattern: 'numbered', prefix: 'veyra_look', count: 12, startIdx: 0 },
  },
  orthas: {
    idle: { pattern: 'numbered', prefix: 'orthas_idle', count: 12, startIdx: 0 },
    walk: { pattern: 'numbered', prefix: 'orthas_guard', count: 12, startIdx: 0 },
    talk: { pattern: 'numbered', prefix: 'orthas_gesture', count: 12, startIdx: 0 },
  },
  sylis: {
    idle: { pattern: 'numbered', prefix: 'sylis_idle', count: 12, startIdx: 0 },
    walk: { pattern: 'numbered', prefix: 'sylis_write', count: 12, startIdx: 0 },
    talk: { pattern: 'numbered', prefix: 'sylis_talk', count: 12, startIdx: 0 },
  },
  lira: {
    idle: { pattern: 'auto', count: 12 },
    walk: { pattern: 'auto', count: 12 },
    talk: { pattern: 'auto', count: 12 },
  },
  elder_maelon: {
    idle: { pattern: 'auto', count: 12 },
    walk: { pattern: 'auto', count: 12, startIdx: 3 },
    talk: { pattern: 'auto', count: 12 },
  },
  vance: {
    idle: { pattern: 'numbered', prefix: 'vance_idle', count: 12, startIdx: 0 },
    walk: { pattern: 'numbered', prefix: 'vance_walking', count: 12, startIdx: 0 },
    talk: { pattern: 'numbered', prefix: 'vance_talking', count: 12, startIdx: 0 },
  },
};

/**
 * Returns the public URL for the avatar image of a given character
 */
export function getCharacterAvatarUrl(characterId: CharacterId): string {
  const scheme = CHARACTER_FRAME_MAP[characterId];
  if (!scheme) {
    return assetUrl(`/characters/${characterId}/idle/auto-001.png`);
  }

  const idleCfg = scheme.idle;
  if (idleCfg.pattern === 'auto') {
    const start = idleCfg.startIdx ?? 1;
    return assetUrl(`/characters/${characterId}/idle/auto-${String(start).padStart(3, '0')}.png`);
  }

  const folder = characterId === 'kaelen' ? 'kealen' : characterId;
  const start = idleCfg.startIdx ?? 0;
  const numStr = String(start).padStart(2, '0');
  const filename = `${numStr}_${idleCfg.prefix}.png`;
  return assetUrl(`/characters/${folder}/idle/${filename}`);
}

export class AnimationManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Builds the file path for a single animation frame. Shared by boot preload
   * and the lazy loader so both resolve identical URLs.
   */
  private static frameFilePath(characterId: CharacterId, animType: AnimationType, index: number): string {
    const scheme = CHARACTER_FRAME_MAP[characterId];
    const cfg = scheme?.[animType] || { pattern: 'auto' as const, count: 8 };
    const count = cfg.count || 8;
    const startIdx = cfg.startIdx !== undefined ? cfg.startIdx : (cfg.pattern === 'auto' ? 1 : 0);
    const i = Math.min(index, count - 1);
    const curIdx = startIdx + i;
    let filename = '';
    if (cfg.pattern === 'auto') {
      filename = `auto-${String(curIdx).padStart(3, '0')}.png`;
    } else if (cfg.pattern === 'numbered') {
      filename = `${String(curIdx).padStart(2, '0')}_${cfg.prefix}.png`;
    } else if (cfg.customFiles && cfg.customFiles[i]) {
      filename = cfg.customFiles[i];
    }
    const folder = characterId === 'kaelen' ? 'kealen' : characterId;
    return assetUrl(`/characters/${folder}/${animType}/${filename}`);
  }

  /**
   * Preloads individual PNG frames for a character. Called from BootScene with
   * ['idle'] only for characters present at boot; walk/talk and off-screen
   * characters are lazy-loaded on first use via ensureAnimation().
   */
  public static preloadCharacter(scene: Phaser.Scene, characterId: CharacterId, animTypes: AnimationType[] = ['idle', 'walk', 'talk']) {
    const scheme = CHARACTER_FRAME_MAP[characterId];

    animTypes.forEach((animType) => {
      const count = scheme?.[animType]?.count || 8;

      for (let i = 0; i < count; i++) {
        const frameKey = `${characterId}_${animType}_${String(i + 1).padStart(3, '0')}`;
        scene.load.image(frameKey, this.frameFilePath(characterId, animType, i));
      }
    });
  }

  /**
   * Ensures a character's IDLE animation is loaded, streaming it in if it was
   * skipped at boot (character not present in the starting scene).
   * Does NOT play anything — the sprite plays once frames exist via playAnim().
   */
  public static ensureIdle(scene: Phaser.Scene, characterId: CharacterId) {
    if (scene.anims.exists(`${characterId}_idle`)) return;
    this.ensureAnimation(scene, characterId, 'idle');
  }

  /** Animations currently being lazy-loaded (keyed by `${characterId}_${animType}`). */
  private static lazyLoading = new Set<string>();

  /**
   * Ensures an animation exists, streaming its frames in on first use.
   * Used for walk/talk frames skipped during boot to keep startup fast.
   */
  public static ensureAnimation(scene: Phaser.Scene, characterId: CharacterId, animType: AnimationType) {
    const animKey = `${characterId}_${animType}`;
    if (scene.anims.exists(animKey) || this.lazyLoading.has(animKey)) return;
    this.lazyLoading.add(animKey);
    this.preloadCharacter(scene, characterId, [animType]);
    scene.load.start();
    scene.load.once('complete', () => {
      this.lazyLoading.delete(animKey);
      new AnimationManager(scene).createCharacterAnimations(characterId);
    });
  }

  /**
   * Registers animations in the Phaser Animation Manager
   */
  public createCharacterAnimations(characterId: CharacterId) {
    const animTypes: AnimationType[] = ['idle', 'walk', 'talk'];
    const frameRates: Record<AnimationType, number> = {
      idle: 6,
      walk: 10,
      talk: 8,
    };

    animTypes.forEach((animType) => {
      const animKey = `${characterId}_${animType}`;

      if (this.scene.anims.exists(animKey)) {
        return;
      }

      const scheme = CHARACTER_FRAME_MAP[characterId];
      const count = scheme?.[animType]?.count || 8;
      const frames: Phaser.Types.Animations.AnimationFrame[] = [];

      for (let i = 1; i <= count; i++) {
        const frameKey = `${characterId}_${animType}_${String(i).padStart(3, '0')}`;
        if (this.scene.textures.exists(frameKey)) {
          frames.push({ key: frameKey });
        }
      }

      if (frames.length > 0) {
        this.scene.anims.create({
          key: animKey,
          frames,
          frameRate: frameRates[animType],
          repeat: -1,
        });
      }
    });
  }

  /**
   * Helper to safely play an animation on a Sprite
   */
  public static playAnim(sprite: Phaser.GameObjects.Sprite, characterId: CharacterId, animType: AnimationType) {
    const animKey = `${characterId}_${animType}`;
    if (!sprite.scene) return;
    // Lazy-stream walk/talk frames on first use (they are not preloaded at boot).
    if (!sprite.scene.anims.exists(animKey)) {
      this.ensureAnimation(sprite.scene, characterId, animType);
    }
    if (sprite.scene.anims.exists(animKey)) {
      if (sprite.anims.currentAnim?.key !== animKey) {
        sprite.play(animKey, true);
      }
    } else if (animType !== 'idle') {
      // Fall back to idle while the new frames stream in.
      const idleKey = `${characterId}_idle`;
      if (sprite.scene.anims.exists(idleKey) && sprite.anims.currentAnim?.key !== idleKey) {
        sprite.play(idleKey, true);
      }
    }
  }
}
