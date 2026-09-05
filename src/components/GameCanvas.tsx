import React, { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';

interface GameCanvasProps {
  onReady: () => void;
  onLoadingProgress: (value: number) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ onReady, onLoadingProgress }) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameContainerRef.current) return;

    let cancelled = false;
    const container = gameContainerRef.current;

    // Lazy-load the Phaser/game chunk so the React shell paints immediately.
    // (The guard also prevents double-initialization in React StrictMode.)
    import('../game/bootstrap')
      .then(({ bootGame }) => {
        if (cancelled) return;
        if (!gameInstanceRef.current) {
          gameInstanceRef.current = bootGame(container, onReady, onLoadingProgress);
        }
      })
      .catch((err) => {
        console.error('[GameCanvas] Failed to load game engine:', err);
        if (!cancelled) setBootError(String(err?.message || err));
      });

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
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
        delete (window as any).gameInstance;
      }
    };
  }, []);

  return (
    <>
      <div
        id="phaser-container"
        ref={gameContainerRef}
        className="absolute inset-0 w-full h-full z-0 overflow-hidden bg-slate-950 select-none touch-none"
      />
      {bootError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/90 p-6 text-center text-red-300">
          Failed to load the game engine. Please refresh the page.
        </div>
      )}
    </>
  );
};
