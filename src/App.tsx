import React, { useEffect, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { AgentInspector } from './components/AgentInspector';
import { StoryProposalModal } from './components/StoryProposalModal';
import { LawProposalModal } from './components/LawProposalModal';
import { ChroniclesPanel } from './components/ChroniclesPanel';
import { WebMCPConsole } from './components/WebMCPConsole';
import { ChatBox } from './components/ChatBox';
import { VirtualControls } from './components/VirtualControls';
import { ProximityPrompt } from './components/ProximityPrompt';
import { QuestTracker } from './components/QuestTracker';
import { initWebMCP } from './services/webmcp';
import { assetUrl } from './config/assets';
import { InterventionRequests } from './components/InterventionRequests';
import { WorldMap } from './components/WorldMap';

export const App: React.FC = () => {
  const [gameReady, setGameReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    // Initialize WebMCP tools registry on document.modelContext & window.UmeggaMCP.
    // Guarded so an experimental/flagged browser API can never crash the app.
    try {
      initWebMCP();
    } catch (err) {
      console.error('[WebMCP] Initialization failed; continuing without WebMCP tools:', err);
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Phaser 3 Canvas Layer */}
      <GameCanvas onReady={() => setGameReady(true)} onLoadingProgress={setLoadingProgress} />

      {!gameReady && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-slate-950 p-6 pointer-events-none">
          <img
            src={assetUrl('/loading-screen.png')}
            alt="Loading Umegga"
            className="absolute inset-0 h-full w-full object-contain"
          />
          <div className="relative mb-4 w-full max-w-lg rounded-xl border border-cyan-300/70 bg-slate-950/90 p-4 text-center shadow-2xl">
            <div className="mb-2 flex items-center justify-between font-fantasy text-sm text-slate-100">
              <span>Forging Umegga Reality Fabric...</span>
              <span className="font-mono text-cyan-200">{Math.floor(loadingProgress * 100)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full border border-cyan-300/60 bg-slate-800">
              <div
                className="h-full rounded-full bg-cyan-300 transition-[width] duration-150"
                style={{ width: `${Math.max(2, loadingProgress * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* React UI Overlay Layer */}
      {gameReady && (
        <>
          <HUD />
          <QuestTracker />
          <ProximityPrompt />
          <InterventionRequests />
          <AgentInspector />
          <StoryProposalModal />
          <LawProposalModal />
          <ChroniclesPanel />
          <WebMCPConsole />
          <ChatBox />
          <VirtualControls />
          <WorldMap />
        </>
      )}
    </div>
  );
};
