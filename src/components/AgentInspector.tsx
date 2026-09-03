import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { SUPPORTED_CHARACTERS } from '../constants/characters';
import { getCharacterAvatarUrl } from '../game/managers/AnimationManager';
import {
  X,
  MessageSquare,
  Sparkles,
  Compass,
  Brain,
  HeartHandshake,
  History,
  Send,
} from 'lucide-react';

export const AgentInspector: React.FC = () => {
  const { selectedAgentId, setSelectedAgentId, agents, addAgentThought, addAgentMemory, sendMessageToAgent, engageAgent } =
    useGameStore();

  const [inputThought, setInputThought] = useState('');

  if (!selectedAgentId) return null;

  const agent = agents.find((a) => a.id === selectedAgentId);
  if (!agent) return null;

  const charMeta = SUPPORTED_CHARACTERS[agent.characterId];

  const handleInspireThought = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputThought.trim()) return;

    addAgentThought(agent.id, inputThought);
    addAgentMemory(agent.id, `Inspired with thought: "${inputThought}"`, 7);
    setInputThought('');
  };

  const handleConverse = () => {
    engageAgent(agent.id);
    void sendMessageToAgent(agent.id, 'What is on your mind right now?');
  };

  return (
    <aside className="fixed right-4 top-20 bottom-24 w-88 md:w-96 bg-slate-900/95 backdrop-blur-xl border border-sky-500/40 rounded-3xl p-5 shadow-2xl z-40 flex flex-col text-slate-100 overflow-hidden">
      {/* Header with Close */}
      <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center p-1">
            <img
              src={getCharacterAvatarUrl(agent.characterId)}
              alt={agent.name}
              className="w-full h-full object-contain"
            />
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
          </div>
          <div>
            <h2 className="font-fantasy font-bold text-sm text-sky-200">{agent.name}</h2>
            <div className="text-xs text-amber-400 font-medium">{agent.role}</div>
          </div>
        </div>
        <button
          onClick={() => setSelectedAgentId(null)}
          className="p-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
        {/* Lore / Role Bio */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Mythic Calling
          </div>
          <p className="text-slate-300 leading-relaxed italic">{charMeta?.lore || 'A sentient inhabitant of the sanctuary.'}</p>
        </div>

        {/* Current State & Affinity */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Compass className="w-3 h-3 text-sky-400" />
              Status
            </div>
            <div className="font-semibold text-sky-300 truncate">{agent.status}</div>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-2.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <HeartHandshake className="w-3 h-3 text-rose-400" />
              Affinity
            </div>
            <div className="font-semibold text-rose-300">+{agent.affinityWithPlayer} Resonance</div>
          </div>
        </div>

        {/* Current Thought */}
        <div className="bg-sky-950/30 border border-sky-500/30 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 text-sky-400 font-semibold mb-1 uppercase tracking-wider text-[10px]">
            <Brain className="w-3 h-3" />
            Active Cognition
          </div>
          <p className="text-sky-100 font-medium">"{agent.currentThought || 'Reflecting in silence...'}"</p>
        </div>

        <div className="bg-amber-950/20 border border-amber-500/25 rounded-2xl p-3">
          <div className="text-[10px] text-amber-300 font-semibold uppercase tracking-wider mb-2">Evolving Personality</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-300">
            {Object.entries(agent.personality?.traits || {}).slice(0, 6).map(([trait, value]) => (
              <div key={trait} className="flex items-center justify-between gap-2"><span className="capitalize">{trait}</span><span className="font-mono text-amber-200">{Math.round(Number(value) * 100)}%</span></div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-slate-400">Growth focus: <span className="text-slate-200">{agent.personality?.growthFocus || 'Learning through experience'}</span></div>
        </div>

        {(agent.goals || []).length > 0 && (
          <div className="bg-emerald-950/20 border border-emerald-500/25 rounded-2xl p-3">
            <div className="text-[10px] text-emerald-300 font-semibold uppercase tracking-wider mb-2">Current Goals</div>
            {(agent.goals || []).filter((goal) => goal.status === 'active').slice(0, 3).map((goal) => (
              <div key={goal.id} className="text-[11px] text-slate-300 mb-1"><span className="text-emerald-200">{goal.type}:</span> {goal.title}</div>
            ))}
          </div>
        )}

        {/* Memory Ledger */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
              <History className="w-3 h-3 text-amber-400" />
              Episodic Memory ({agent.memory.length})
            </span>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {agent.memory.map((mem) => (
              <div
                key={mem.id}
                className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-2 text-[11px] flex items-start justify-between gap-2"
              >
                <span className="text-slate-300 leading-snug">{mem.event}</span>
                <span className="text-[9px] text-slate-500 font-mono whitespace-nowrap">{mem.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions: Converse & Inscribe Thought */}
      <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
        <button
          onClick={handleConverse}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/30 transition-all cursor-pointer"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Converse with {agent.name.split(' ')[0]}
        </button>

        <form onSubmit={handleInspireThought} className="flex gap-2">
          <input
            type="text"
            placeholder="Inscribe a thought into their mind..."
            value={inputThought}
            onChange={(e) => setInputThought(e.target.value)}
            className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
          />
          <button
            type="submit"
            className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer"
            title="Inscribe Thought"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
};
