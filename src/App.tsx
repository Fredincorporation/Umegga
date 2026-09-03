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
import { initWebMCP } from './services/webmcp';

export const App: React.FC = () => {
  const [gameReady, setGameReady] = useState(false);

  useEffect(() => {
    // Initialize WebMCP tools registry on document.modelContext & window.umegaMCP
    initWebMCP();
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Phaser 3 Canvas Layer */}
      <GameCanvas onReady={() => setGameReady(true)} />

      {/* React UI Overlay Layer */}
      {gameReady && (
        <>
          <HUD />
          <AgentInspector />
          <StoryProposalModal />
          <LawProposalModal />
          <ChroniclesPanel />
          <WebMCPConsole />
          <ChatBox />
          <VirtualControls />
        </>
      )}
    </div>
  );
};
