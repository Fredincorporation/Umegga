import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { X, BookOpen, Scale, Scroll, Sparkles, ShieldCheck } from 'lucide-react';

export const ChroniclesPanel: React.FC = () => {
  const { activePanel, setActivePanel, world } = useGameStore();
  const [tab, setTab] = useState<'stories' | 'laws'>('stories');
  const [readingStoryId, setReadingStoryId] = useState<string | null>(null);

  if (activePanel !== 'chronicles') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-slate-900 border border-purple-500/40 rounded-3xl p-6 shadow-2xl relative text-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-950 border border-purple-500/40 text-purple-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-fantasy font-bold text-lg text-purple-300">The Great Chronicles of Umega</h2>
              <p className="text-xs text-slate-400">Archived reality-shaping stories and binding civic laws</p>
            </div>
          </div>
          <button
            onClick={() => setActivePanel('none')}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('stories')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              tab === 'stories'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Scroll className="w-4 h-4" />
            <span>Enacted Stories ({world.chronicles.length})</span>
          </button>
          <button
            onClick={() => setTab('laws')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              tab === 'laws'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Active Laws ({world.activeLaws.length})</span>
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {tab === 'stories' ? (
            world.chronicles.map((story) => (
              <div
                key={story.id}
                className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 hover:border-sky-500/40 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-fantasy font-bold text-sm text-sky-300">{story.title}</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-500/30 text-sky-400">
                    <Sparkles className="w-3 h-3" />
                    {story.resonance}% Resonance
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed italic line-clamp-2">"{story.content}"</p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <span>Woven by: <strong className="text-slate-200">{story.author}</strong></span>
                    <span>•</span>
                    <span className="text-amber-400 font-medium">Impact: {story.impactSummary}</span>
                  </div>
                  <span className="font-mono">{story.timestamp}</span>
                </div>
                <button
                  onClick={() => setReadingStoryId(story.id)}
                  className="w-full rounded-xl border border-sky-500/40 bg-sky-950/50 px-3 py-2 text-left text-[11px] font-semibold text-sky-200 transition-colors hover:bg-sky-900/70"
                >
                  Read full chronicle
                </button>
              </div>
            ))
          ) : (
            world.activeLaws.map((law) => (
              <div
                key={law.id}
                className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 hover:border-amber-500/40 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <h3 className="font-fantasy font-bold text-sm text-amber-300">{law.title}</h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-300">
                    {law.category}
                  </span>
                </div>
                <p className="text-slate-200 leading-relaxed font-medium">"{law.edict}"</p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                  <span className="text-emerald-400 font-mono">Effect: {law.effect.description}</span>
                  <span>Enacted by: <strong className="text-slate-200">{law.author}</strong></span>
                </div>
              </div>
            ))
          )}
        </div>
        {readingStoryId && (() => {
          const story = world.chronicles.find((entry) => entry.id === readingStoryId);
          if (!story) return null;
          return (
            <div className="absolute inset-4 z-10 flex flex-col overflow-hidden rounded-2xl border border-sky-400/50 bg-slate-950/95 p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">Full Chronicle</div>
                  <h3 className="mt-1 font-fantasy text-xl font-bold text-sky-200">{story.title}</h3>
                  <div className="mt-1 text-[10px] text-slate-400">Woven by {story.author} • {story.timestamp}</div>
                </div>
                <button onClick={() => setReadingStoryId(null)} className="rounded-xl bg-slate-800 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white" title="Close full chronicle">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-5 text-sm leading-7 text-slate-200">
                {(story.fullContent || story.content).split(/\n\s*\n/).map((paragraph, index) => <p key={`${story.id}_paragraph_${index}`} className="mb-4">{paragraph}</p>)}
              </div>
              <div className="border-t border-slate-800 pt-3 text-xs text-amber-300">World effect: {story.impactSummary}</div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
