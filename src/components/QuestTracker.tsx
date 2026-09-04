import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Target, CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles, Award } from 'lucide-react';

export const QuestTracker: React.FC = () => {
  const { quests, dailyQuests } = useGameStore();
  const [collapsed, setCollapsed] = useState(true);

  const completedCount = quests.filter((q) => q.completed).length;
  const allCompleted = completedCount === quests.length;
  const dailyCompleted = dailyQuests.filter((quest) => quest.completed).length;

  return (
    <div className="fixed top-36 left-3 z-20 pointer-events-auto max-w-xs md:max-w-sm">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-sky-500/30 rounded-2xl shadow-2xl p-3 text-slate-100 transition-all">
        {/* Tracker Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-400">
              <Target className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                <span>Mythic Quests</span>
                {allCompleted && (
                  <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                    <Award className="w-2.5 h-2.5" /> Complete
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Daily: {dailyCompleted} / {dailyQuests.length}
              </div>
            </div>
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={collapsed ? 'Expand Quest Log' : 'Collapse Quest Log'}
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Quests List */}
        {!collapsed && (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
            {dailyQuests.map((quest) => (
              <div
                key={quest.id}
                className={`p-2 rounded-xl border transition-all ${quest.completed
                  ? 'bg-slate-800/40 border-emerald-500/30 opacity-75'
                  : 'bg-slate-800/80 border-sky-500/30 shadow-md'
                  }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {quest.completed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`font-semibold truncate ${quest.completed ? 'text-slate-400 line-through' : 'text-slate-100'
                          }`}
                      >
                        {quest.title}
                      </span>
                      <span className="text-[9px] font-mono text-amber-400 flex items-center gap-0.5 shrink-0">
                        <Sparkles className="w-2.5 h-2.5" />
                        +{quest.rewardMana}m
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">{quest.objective} ({Math.min(quest.currentCount || 0, quest.targetCount || 1)} / {quest.targetCount || 1})</div>
                    <div className="text-[10px] text-slate-400 italic mt-0.5">{quest.description}</div>
                  </div>
                </div>
              </div>
            ))}
            <div className="border-t border-slate-700 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Foundational Quests</div>
            {quests.map((quest) => (
              <div key={quest.id} className={`rounded-xl border p-2 ${quest.completed ? 'border-emerald-500/30 opacity-75' : 'border-slate-700 bg-slate-800/60'}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-200">{quest.title}</span><span className="text-[9px] text-amber-400">+{quest.rewardMana}m</span></div>
                <div className="mt-0.5 text-[10px] text-slate-400">{quest.objective}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
