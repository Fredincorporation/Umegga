import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { SanctuaryScene } from './scenes/SanctuaryScene';
import { OracleBasinScene } from './scenes/OracleBasinScene';
import { BotanistGroveScene } from './scenes/BotanistGroveScene';
import { GrandForgeScene } from './scenes/GrandForgeScene';
import { BardsAmphitheatreScene } from './scenes/BardsAmphitheatreScene';
import { FrayingMarchScene } from './scenes/FrayingMarchScene';
import { OuterWastesScene } from './scenes/OuterWastesScene';

export function createGameConfig(container: HTMLElement, onReady: () => void, onLoadingProgress: (value: number) => void): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: container,
    backgroundColor: '#020617',
    width: container.clientWidth || window.innerWidth,
    height: container.clientHeight || window.innerHeight,
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
    },
    loader: {
      maxParallelDownloads: 8,
    },
    callbacks: {
      preBoot: (game) => {
        game.registry.set('onReady', onReady);
        game.registry.set('onLoadingProgress', onLoadingProgress);
      },
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [
      BootScene,
      SanctuaryScene,
      OracleBasinScene,
      BotanistGroveScene,
      GrandForgeScene,
      BardsAmphitheatreScene,
      FrayingMarchScene,
      OuterWastesScene,
    ],
  };
}
