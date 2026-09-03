import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';

export const InterventionRequests: React.FC = () => {
  const { interventionRequests, agents, resolveIntervention } = useGameStore();
  const pending = interventionRequests.filter((request) => request.status === 'pending');

  if (pending.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-40 w-80 space-y-2 pointer-events-auto">
      {pending.map((request) => {
        const agent = agents.find((item) => item.id === request.agentId);
        if (!agent) return null;
        return (
          <div key={request.id} className="rounded-xl border border-amber-400/60 bg-slate-950/95 p-3 text-slate-100 shadow-2xl">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-amber-200">{agent.name} requests your guidance</div>
                <p className="mt-1 text-[11px] leading-snug text-slate-300">{request.reason}</p>
                <p className="mt-1 text-[10px] text-slate-400">Suggested action: {request.action}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => resolveIntervention(request.id, true)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-semibold hover:bg-emerald-500">
                <Check className="h-3 w-3" /> Guide agent
              </button>
              <button onClick={() => resolveIntervention(request.id, false)} className="flex items-center justify-center rounded-lg bg-slate-800 px-3 py-1.5 text-slate-400 hover:text-white" title="Ignore request">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
