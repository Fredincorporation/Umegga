import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { MessageSquare, Sparkles } from 'lucide-react';
import { getCharacterAvatarUrl } from '../game/managers/AnimationManager';

export const ProximityPrompt: React.FC = () => {
  const { nearbyAgent, interactWithNearbyAgent, activePanel, engagedAgentId } = useGameStore();

  if (!nearbyAgent || (activePanel === 'agent_inspector' && !engagedAgentId)) return null;

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-bounce-subtle">
      <button
        onClick={interactWithNearbyAgent}
        className="group bg-slate-900/90 hover:bg-slate-800/95 backdrop-blur-xl border-2 border-sky-400/80 hover:border-amber-400 rounded-2xl px-4 py-2.5 shadow-2xl shadow-sky-950/60 flex items-center gap-3 transition-all transform hover:scale-105 cursor-pointer"
      >
        {/* Avatar Mini Icon */}
        <div className="relative w-8 h-8 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-center overflow-hidden">
          <img
            src={getCharacterAvatarUrl(nearbyAgent.characterId)}
            alt={nearbyAgent.name}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Action Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-400/60 text-sky-200 font-mono font-bold text-xs shadow-inner">
          <span className="bg-sky-400 text-slate-950 px-1.5 py-0.5 rounded text-[10px] font-black tracking-wider">
            E
          </span>
          <span>{engagedAgentId ? 'END CHAT' : 'TALK'}</span>
        </div>

        {/* Text Info */}
        <div className="text-left pr-1">
          <div className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
            <span>{nearbyAgent.name}</span>
            <Sparkles className="w-3 h-3 text-amber-400" />
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            {nearbyAgent.role} • <span className="text-sky-300">+15 Mana</span>
          </div>
        </div>

        <MessageSquare className="w-4 h-4 text-sky-400 group-hover:text-amber-400 ml-1 transition-colors" />
      </button>
    </div>
  );
};
