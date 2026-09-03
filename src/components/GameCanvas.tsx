import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from '../game/config';

interface GameCanvasProps {
  onReady: () => void;
  onLoadingProgress: (value: number) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ onReady, onLoadingProgress }) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameContainerRef.current) return;

    // Prevent double-initialization in React StrictMode
    if (!gameInstanceRef.current) {
      const config = createGameConfig(gameContainerRef.current, onReady, onLoadingProgress);
      gameInstanceRef.current = new Phaser.Game(config);
      (window as any).gameInstance = gameInstanceRef.current;
    }

    const handleResize = () => {
      if (gameInstanceRef.current && gameContainerRef.current) {
        gameInstanceRef.current.scale.resize(
          gameContainerRef.current.clientWidth,
          gameContainerRef.current.clientHeight
        );
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
        delete (window as any).gameInstance;
      }
    };
  }, []);

  return (
    <div
      id="phaser-container"
      ref={gameContainerRef}
      className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-slate-950 select-none touch-none"
    />
  );
};
