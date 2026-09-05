// This module is loaded dynamically (see GameCanvas.tsx) so that Phaser and all
// game code live in a separate async chunk. The initial bundle stays small and
// the app shell paints while the engine chunk downloads.
import Phaser from 'phaser';
import { createGameConfig } from './config';

export function bootGame(container: HTMLElement, onReady: () => void, onLoadingProgress: (value: number) => void): Phaser.Game {
  const config = createGameConfig(container, onReady, onLoadingProgress);
  const game = new Phaser.Game(config);
  (window as unknown as { gameInstance?: Phaser.Game }).gameInstance = game;
  return game;
}
