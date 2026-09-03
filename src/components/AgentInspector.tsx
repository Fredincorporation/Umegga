import React, { useEffect, useRef, useState } from 'react';
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
  const { selectedAgentId, setSelectedAgentId, agents, messages, player, sendMessageToAgent } =
    useGameStore();

  const [message, setMessage] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const agent = selectedAgentId ? agents.find((a) => a.id === selectedAgentId) : undefined;
  const conversationMessages = agent
    ? messages.filter((item) => item.channel === 'conversation' && (item.recipientAgentId === agent.id || item.senderId === agent.id))
    : [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages.length, isReplying]);

  useEffect(() => {
    if (agent && useGameStore.getState().engagedAgentId === agent.id) messageInputRef.current?.focus();
  }, [agent]);

  useEffect(() => {
    if (!agent) return undefined;

    const movementKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e']);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setSelectedAgentId(null);
        return;
      }
      const target = event.target as HTMLElement | null;
      const isTextEntry = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (!isTextEntry && movementKeys.has(event.key.toLowerCase())) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [agent, setSelectedAgentId]);

  if (!agent) return null;

  const charMeta = SUPPORTED_CHARACTERS[agent.characterId];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text || isReplying) return;
    setMessage('');
    setIsReplying(true);
    void sendMessageToAgent(agent.id, text).finally(() => setIsReplying(false));
  };

  return (
    <aside
      className="fixed right-4 top-20 bottom-24 w-88 md:w-96 bg-slate-900/95 backdrop-blur-xl border border-sky-500/40 rounded-3xl p-5 shadow-2xl z-40 flex flex-col text-slate-100 overflow-hidden"
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setSelectedAgentId(null);
        }
      }}
    >
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
        {/* Primary messenger thread */}
        <section className="bg-slate-950/70 border border-sky-500/30 rounded-2xl p-3 flex flex-col min-h-64">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-sky-300 font-semibold uppercase tracking-wider text-[10px]">
              <MessageSquare className="w-3 h-3" />
              Chat Thread
            </div>
            <span className="text-[10px] text-slate-500">{conversationMessages.length} messages</span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {conversationMessages.length === 0 && (
              <div className="py-8 text-center text-slate-500">Start a conversation with {agent.name}.</div>
            )}
            {conversationMessages.map((item) => {
              const isPlayer = item.sender === player.name;
              return (
                <div key={item.id} className={`flex ${isPlayer ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[84%] rounded-2xl px-3 py-2 ${isPlayer ? 'bg-sky-600 text-white rounded-br-sm' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm'}`}>
                    <div className={`text-[9px] mb-0.5 ${isPlayer ? 'text-sky-100' : 'text-amber-300'}`}>{isPlayer ? 'You' : agent.name}</div>
                    <p className="leading-relaxed break-words">{item.text}</p>
                    <div className={`text-[9px] mt-1 ${isPlayer ? 'text-sky-200' : 'text-slate-500'}`}>{item.timestamp}</div>
                  </div>
                </div>
              );
            })}
            {isReplying && (
              <div className="flex justify-start"><div className="rounded-2xl rounded-bl-sm bg-slate-800 border border-slate-700 px-3 py-2 text-slate-400">{agent.name} is thinking...</div></div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="mt-3 flex gap-2 border-t border-slate-800 pt-3">
            <input
              ref={messageInputRef}
              type="text"
              placeholder={`Message ${agent.name}...`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') event.stopPropagation();
              }}
              disabled={isReplying}
              className="min-w-0 flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 disabled:opacity-60"
            />
            <button type="submit" disabled={isReplying || !message.trim()} className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer disabled:opacity-50" title="Send message">
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </section>

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
          <button type="button" onClick={() => setShowMemory(!showMemory)} className="w-full flex items-center justify-between mb-2 text-left cursor-pointer">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
              <History className="w-3 h-3 text-amber-400" />
              Episodic Memory ({agent.memory.length})
            </span>
            <span className="text-[10px] text-amber-300">{showMemory ? 'Hide memory' : 'Click to view memory'}</span>
          </button>
          {showMemory && <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {agent.memory.map((mem) => (
              <div
                key={mem.id}
                className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-2 text-[11px] flex items-start justify-between gap-2"
              >
                <span className="text-slate-300 leading-snug">{mem.event}</span>
                <span className="text-[9px] text-slate-500 font-mono whitespace-nowrap">{mem.timestamp}</span>
              </div>
            ))}
          </div>}
        </div>
      </div>

    </aside>
  );
};
