import React, { useMemo, useState } from 'react';
import { LocateFixed, Map, MapPin, X } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { SceneKey } from '../types/game';
import { getCharacterAvatarUrl } from '../game/managers/AnimationManager';

const SCENES: Array<{ key: SceneKey; label: string; color: string }> = [
  { key: 'SanctuaryScene', label: 'Sanctuary', color: '#38bdf8' },
  { key: 'OracleBasinScene', label: 'Oracle Basin', color: '#c084fc' },
  { key: 'BotanistGroveScene', label: 'Botanist Grove', color: '#4ade80' },
  { key: 'GrandForgeScene', label: 'Grand Forge', color: '#fb923c' },
  { key: 'BardsAmphitheatreScene', label: "Bard's Amphitheatre", color: '#facc15' },
  { key: 'FrayingMarchScene', label: 'Fraying March', color: '#2dd4bf' },
  { key: 'OuterWastesScene', label: 'Outer Wastes', color: '#d6d3d1' },
];

const sceneName = (scene?: SceneKey) => SCENES.find((item) => item.key === scene)?.label || 'Sanctuary';

export const WorldMap: React.FC = () => {
  const { activePanel, setActivePanel, agents, player, setSelectedAgentId } = useGameStore();
  const [sceneFilter, setSceneFilter] = useState<'all' | SceneKey>('all');

  const visibleAgents = useMemo(
    () => agents.filter((agent) => sceneFilter === 'all' || (agent.currentScene || 'SanctuaryScene') === sceneFilter),
    [agents, sceneFilter],
  );
  const visiblePlayer = sceneFilter === 'all' || sceneFilter === player.currentScene;

  const selectAgent = (agentId: string) => {
    setActivePanel('agent_inspector');
    setSelectedAgentId(agentId);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setActivePanel(activePanel === 'world_map' ? 'none' : 'world_map')}
        className={`fixed right-4 bottom-4 z-[35] flex h-12 w-12 items-center justify-center rounded-2xl border shadow-2xl transition-all cursor-pointer ${activePanel === 'world_map' ? 'border-cyan-300 bg-cyan-500 text-slate-950' : 'border-cyan-400/50 bg-slate-900/95 text-cyan-300 hover:border-cyan-300 hover:bg-slate-800'}`}
        title="Open agent map"
        aria-label="Open agent map"
      >
        <Map className="h-5 w-5" />
      </button>

      {activePanel === 'world_map' && (
        <section className="fixed right-4 bottom-20 z-40 w-[min(92vw,30rem)] overflow-hidden rounded-3xl border border-cyan-400/50 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-xl">
          <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-cyan-400/40 bg-cyan-950/70 p-2 text-cyan-300"><MapPin className="h-4 w-4" /></div>
              <div>
                <h2 className="font-fantasy text-sm font-bold text-cyan-200">Agent Cartography</h2>
                <p className="text-[10px] text-slate-400">Live positions across Umegga</p>
              </div>
            </div>
            <button type="button" onClick={() => setActivePanel('none')} className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer" title="Close map" aria-label="Close map">
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-3 py-2 text-[10px]">
            <button type="button" onClick={() => setSceneFilter('all')} className={`shrink-0 rounded-lg px-2 py-1 cursor-pointer ${sceneFilter === 'all' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'}`}>All realms</button>
            {SCENES.map((scene) => (
              <button key={scene.key} type="button" onClick={() => setSceneFilter(scene.key)} className={`shrink-0 rounded-lg px-2 py-1 cursor-pointer ${sceneFilter === scene.key ? 'text-slate-950 font-semibold' : 'bg-slate-800 text-slate-300'}`} style={sceneFilter === scene.key ? { backgroundColor: scene.color } : undefined}>{scene.label}</button>
            ))}
          </div>

          <div className="p-3">
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-slate-700 bg-[#101b2b]" style={{ backgroundImage: 'linear-gradient(rgba(103, 232, 249, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(103, 232, 249, 0.08) 1px, transparent 1px)', backgroundSize: '10% 10%' }}>
              <div className="absolute inset-[8%] rounded-[35%] border border-cyan-400/20 bg-cyan-950/20" />
              <div className="absolute left-1/2 top-[8%] bottom-[8%] border-l border-dashed border-cyan-300/10" />
              <div className="absolute top-1/2 left-[8%] right-[8%] border-t border-dashed border-cyan-300/10" />
              <span className="absolute left-3 top-2 text-[9px] uppercase tracking-widest text-cyan-400/60">North / Umegga</span>

              {visiblePlayer && (
                <div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: `${(player.x / 1200) * 100}%`, top: `${(player.y / 1200) * 100}%` }} title={`You · ${sceneName(player.currentScene)}`}>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-cyan-500 shadow-lg shadow-cyan-400/50"><LocateFixed className="h-4 w-4 text-white" /></div>
                  <span className="absolute left-1/2 top-8 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950/90 px-1.5 py-0.5 text-[9px] text-cyan-200">You</span>
                </div>
              )}

              {visibleAgents.map((agent) => {
                const scene = SCENES.find((item) => item.key === (agent.currentScene || 'SanctuaryScene'));
                return (
                  <button key={agent.id} type="button" onClick={() => selectAgent(agent.id)} className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125" style={{ left: `${(agent.x / 1200) * 100}%`, top: `${(agent.y / 1200) * 100}%` }} title={`${agent.name} · ${scene?.label || 'Sanctuary'} · (${Math.round(agent.x)}, ${Math.round(agent.y)})`} aria-label={`Locate ${agent.name}`}>
                    <span className="block h-7 w-7 overflow-hidden rounded-full border-2 bg-slate-900 shadow-lg" style={{ borderColor: scene?.color || '#67e8f9' }}><img src={getCharacterAvatarUrl(agent.characterId)} alt="" className="h-full w-full object-contain" /></span>
                    <span className="absolute left-1/2 top-8 -translate-x-1/2 whitespace-nowrap rounded bg-slate-950/90 px-1.5 py-0.5 text-[9px] text-slate-200">{agent.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-slate-400"><span className="font-semibold text-cyan-300">{visibleAgents.length}</span> agents shown</div>
              <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-right text-slate-400">Click a marker to inspect</div>
            </div>
          </div>
        </section>
      )}
    </>
  );
};
