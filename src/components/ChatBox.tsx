import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { MessageSquare, Send, ChevronUp, ChevronDown } from 'lucide-react';

export const ChatBox: React.FC = () => {
  const { messages, addMessage, sendMessageToAgent, player, selectedAgentId, nearbyAgent } = useGameStore();
  const [inputValue, setInputValue] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [filter, setFilter] = useState<'all' | 'agents' | 'chronicles' | 'mcp'>('all');
  const [collapsed, setCollapsed] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, collapsed]);

  useEffect(() => {
    if (selectedAgentId && !collapsed) inputRef.current?.focus();
  }, [selectedAgentId, collapsed]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const message = inputValue.trim();
    const recipientId = selectedAgentId || nearbyAgent?.id;
    if (recipientId) {
      setIsReplying(true);
      void sendMessageToAgent(recipientId, message).finally(() => setIsReplying(false));
    } else {
      addMessage({
        sender: player.name,
        avatarId: player.characterId,
        text: message,
        type: 'chat',
      });
    }

    setInputValue('');
  };

  const filteredMessages = messages.filter((msg) => {
    if (filter === 'all') return true;
    if (filter === 'agents') return msg.type === 'agent';
    if (filter === 'chronicles') return msg.type === 'story' || msg.type === 'law';
    if (filter === 'mcp') return msg.type === 'mcp';
    return true;
  });

  return (
    <div
      className={`fixed left-4 bottom-4 z-30 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl transition-all duration-300 flex flex-col overflow-hidden text-slate-100 ${collapsed ? 'h-12' : 'h-72'
        }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-sky-400" />
          <span className="font-fantasy font-semibold text-xs text-sky-200">Sanctuary Log & Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Filter Pills */}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-950/40 border-b border-slate-800/80 text-[10px]">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-0.5 rounded-lg font-medium transition-colors cursor-pointer ${filter === 'all' ? 'bg-sky-950 text-sky-300 border border-sky-500/40' : 'text-slate-400 hover:text-white'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('agents')}
              className={`px-2 py-0.5 rounded-lg font-medium transition-colors cursor-pointer ${filter === 'agents' ? 'bg-purple-950 text-purple-300 border border-purple-500/40' : 'text-slate-400 hover:text-white'
                }`}
            >
              Agents
            </button>
            <button
              onClick={() => setFilter('chronicles')}
              className={`px-2 py-0.5 rounded-lg font-medium transition-colors cursor-pointer ${filter === 'chronicles' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
                }`}
            >
              Chronicles
            </button>
            <button
              onClick={() => setFilter('mcp')}
              className={`px-2 py-0.5 rounded-lg font-medium transition-colors cursor-pointer ${filter === 'mcp' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                }`}
            >
              WebMCP
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
            {filteredMessages.map((msg) => {
              const isStory = msg.type === 'story';
              const isLaw = msg.type === 'law';
              const isMCP = msg.type === 'mcp';
              const isAgent = msg.type === 'agent';

              return (
                <div
                  key={msg.id}
                  className={`p-2 rounded-xl flex items-start gap-2 ${isStory
                      ? 'bg-sky-950/60 border border-sky-500/30'
                      : isLaw
                        ? 'bg-amber-950/60 border border-amber-500/30'
                        : isMCP
                          ? 'bg-emerald-950/60 border border-emerald-500/30 font-mono text-[11px]'
                          : isAgent
                            ? 'bg-purple-950/40 border border-purple-500/20'
                            : 'bg-slate-800/40'
                    }`}
                >
                  {msg.avatarId && (
                    <img
                      src={`/characters/${msg.avatarId}/idle/auto-001.png`}
                      alt={msg.sender}
                      className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 shrink-0 object-contain mt-0.5"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span
                        className={`font-semibold truncate ${isStory
                            ? 'text-sky-300'
                            : isLaw
                              ? 'text-amber-300'
                              : isMCP
                                ? 'text-emerald-300'
                                : isAgent
                                  ? 'text-purple-300'
                                  : 'text-slate-300'
                          }`}
                      >
                        {msg.sender} {msg.role ? `(${msg.role})` : ''}
                      </span>
                      <span className="text-slate-500 font-mono text-[9px]">{msg.timestamp}</span>
                    </div>
                    <p className="text-slate-200 leading-snug break-words">{msg.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-2 border-t border-slate-800 flex gap-2 bg-slate-950/50">
            <input
              ref={inputRef}
              type="text"
              placeholder={selectedAgentId || nearbyAgent ? 'Speak to this agent...' : 'Speak to the sanctuary...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={isReplying}
              className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
};
