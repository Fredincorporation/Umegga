import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { SUPPORTED_CHARACTERS } from '../constants/characters';
import { CharacterId, WeatherType, SceneKey } from '../types/game';
import { getCharacterAvatarUrl } from '../game/managers/AnimationManager';
import {
  Sparkles,
  Scroll,
  Scale,
  Bot,
  CloudSun,
  BookOpen,
  Users,
  Compass,
  Zap,
  Wifi,
  ChevronDown,
  MapPin,
  Shield,
} from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabase';

export const HUD: React.FC = () => {
  const {
    player,
    world,
    agents,
    setPlayerCharacter,
    setWeather,
    activePanel,
    setActivePanel,
    setSelectedAgentId,
    godMode,
    setGodMode,
  } = useGameStore();

  const [charPickerOpen, setCharPickerOpen] = useState(false);
  const [weatherPickerOpen, setWeatherPickerOpen] = useState(false);
  const [realmPickerOpen, setRealmPickerOpen] = useState(false);

  const activeCharMeta = SUPPORTED_CHARACTERS[player.characterId];
  const currentAreaMana = world.manaByScene[player.currentScene] ?? world.manaLevel;

  const realms: { key: SceneKey; name: string; icon: string; themeColor: string }[] = [
    { key: 'SanctuaryScene', name: 'Umega Sanctuary', icon: '🏛️', themeColor: 'text-sky-300' },
    { key: 'OracleBasinScene', name: 'Oracle Basin', icon: '🔮', themeColor: 'text-purple-300' },
    { key: 'BotanistGroveScene', name: 'Botanist Grove', icon: '🌿', themeColor: 'text-emerald-300' },
    { key: 'GrandForgeScene', name: 'Grand Forge', icon: '🔥', themeColor: 'text-orange-300' },
    { key: 'BardsAmphitheatreScene', name: "Bard's Amphitheatre", icon: '🎭', themeColor: 'text-rose-300' },
    { key: 'FrayingMarchScene', name: 'Fraying March', icon: '🌌', themeColor: 'text-teal-300' },
    { key: 'OuterWastesScene', name: 'Outer Wastes', icon: '🏜️', themeColor: 'text-stone-300' },
  ];

  const handleTravelToRealm = (sceneKey: SceneKey) => {
    setRealmPickerOpen(false);
    if (typeof window !== 'undefined' && (window as any).gameInstance) {
      const game = (window as any).gameInstance as Phaser.Game;
      const currentActive = game.scene.getScenes(true)[0];
      if (currentActive && currentActive.scene.key !== sceneKey) {
        currentActive.scene.start(sceneKey, { fromScene: player.currentScene });
      }
    }
  };

  const weatherOptions: { id: WeatherType; label: string; icon: string }[] = [
    { id: 'clear', label: 'Clear Skies', icon: '☀️' },
    { id: 'aurora', label: 'Mythic Aurora', icon: '🌌' },
    { id: 'aether_storm', label: 'Aether Storm', icon: '⚡' },
    { id: 'golden_hour', label: 'Golden Luminescence', icon: '🌅' },
    { id: 'eclipse', label: 'Void Eclipse', icon: '🌑' },
  ];

  return (
    <header className="absolute inset-x-0 top-0 z-30 p-3 pointer-events-none flex flex-col gap-2">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-3 w-full">
        {/* Left: City Title & Weather */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* City / Realm Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setRealmPickerOpen(!realmPickerOpen);
                setWeatherPickerOpen(false);
                setCharPickerOpen(false);
              }}
              className="bg-slate-900/90 backdrop-blur-md border border-sky-500/30 hover:border-sky-400/60 rounded-xl px-4 py-2 shadow-2xl flex items-center gap-3 cursor-pointer text-left transition-all"
            >
              <div className="p-2 rounded-lg bg-sky-950/80 border border-sky-400/40 text-sky-400">
                <Compass className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-fantasy font-bold text-base text-amber-300 tracking-wider">
                    {world.cityName}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                    <Wifi className="w-2.5 h-2.5" />
                    {isSupabaseConfigured ? 'Live' : 'Nexus'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Distortion: {(world.realityDistortion * 100).toFixed(0)}%</span>
                  <span>•</span>
                  <span>Laws: {world.activeLaws.length}</span>
                </div>
              </div>
            </button>

            {realmPickerOpen && (
              <div className="absolute top-full mt-1.5 left-0 w-64 bg-slate-900/95 backdrop-blur-xl border border-sky-500/40 rounded-2xl p-2 shadow-2xl z-50 flex flex-col gap-1">
                <div className="text-[10px] uppercase font-bold text-sky-400 px-2 py-1 tracking-wider flex items-center gap-1.5 border-b border-slate-800">
                  <MapPin className="w-3 h-3 text-sky-400" />
                  Travel Realm
                </div>
                {realms.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => handleTravelToRealm(r.key)}
                    className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl text-left transition-all cursor-pointer ${player.currentScene === r.key
                      ? 'bg-sky-950/80 text-amber-300 border border-amber-500/40 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{r.icon}</span>
                      <span className={r.themeColor}>{r.name}</span>
                    </div>
                    {player.currentScene === r.key && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">Here</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Weather Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setWeatherPickerOpen(!weatherPickerOpen);
                setCharPickerOpen(false);
              }}
              className="bg-slate-900/90 backdrop-blur-md border border-slate-700/60 hover:border-sky-400/50 rounded-xl px-3 py-2 text-xs text-slate-200 flex items-center gap-2 transition-all shadow-lg cursor-pointer"
            >
              <CloudSun className="w-4 h-4 text-sky-400" />
              <span className="capitalize">{world.weather.replace('_', ' ')}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {weatherPickerOpen && (
              <div className="absolute top-full mt-1 left-0 w-48 bg-slate-900/95 backdrop-blur-lg border border-sky-500/40 rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-1">
                {weatherOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setWeather(opt.id);
                      setWeatherPickerOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg text-left transition-colors cursor-pointer ${world.weather === opt.id
                      ? 'bg-sky-900/80 text-sky-200 font-medium'
                      : 'text-slate-300 hover:bg-slate-800'
                      }`}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setGodMode(!godMode)}
          className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${godMode ? 'border-amber-400/70 bg-amber-500/20 text-amber-200' : 'border-slate-700 bg-slate-900/90 text-slate-400 hover:text-white'}`}
          title="Toggle God Mode"
        >
          <Shield className="h-3.5 w-3.5" />
          {godMode ? 'God Mode' : 'Observer'}
        </button>

        {/* Center: Dual Mana Gauges (City & Player) */}
        <div className="hidden md:flex items-center gap-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl px-4 py-2 pointer-events-auto shadow-xl">
          {/* Player Mana */}
          <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <div className="w-32">
              <div className="flex justify-between text-[11px] mb-1 font-mono">
                <span className="text-slate-400">Player Mana</span>
                <span className="text-amber-300 font-semibold">{player.mana} / 500</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (player.mana / 500) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* District / City Mana */}
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-400 animate-pulse" />
            <div className="w-32">
              <div className="flex justify-between text-[11px] mb-1 font-mono">
                <span className="text-slate-400">Realm Mana</span>
                <span className="text-sky-300 font-semibold">{currentAreaMana} / 1000</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${(currentAreaMana / 1000) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Character Switcher & Quick Navigation */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Active Character Badge */}
          <div className="relative">
            <button
              onClick={() => {
                setCharPickerOpen(!charPickerOpen);
                setWeatherPickerOpen(false);
              }}
              className="bg-slate-900/90 backdrop-blur-md border border-slate-700/60 hover:border-amber-400/50 rounded-xl p-1.5 pr-3 flex items-center gap-2.5 transition-all shadow-lg cursor-pointer"
            >
              <img
                src={getCharacterAvatarUrl(player.characterId)}
                alt={activeCharMeta?.name}
                className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-600 p-0.5 object-contain"
              />
              <div className="text-left">
                <div className="text-xs font-semibold text-amber-200">
                  {activeCharMeta?.name.split(' ')[0]}
                </div>
                <div className="text-[10px] text-slate-400">{activeCharMeta?.role}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Character Selection Popover */}
            {charPickerOpen && (
              <div className="absolute top-full mt-2 right-0 w-72 bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 rounded-2xl p-3 shadow-2xl z-50">
                <div className="text-xs font-semibold text-amber-300 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Select Avatar
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(SUPPORTED_CHARACTERS) as CharacterId[]).map((cId) => {
                    const cMeta = SUPPORTED_CHARACTERS[cId];
                    const isSelected = player.characterId === cId;
                    return (
                      <button
                        key={cId}
                        onClick={() => {
                          const selectedAgent = agents.find((agent) => agent.characterId === cId);
                          const currentActive = typeof window !== 'undefined'
                            ? (window as any).gameInstance?.scene?.getScenes(true)?.[0]
                            : null;
                          if (selectedAgent?.currentScene && currentActive) {
                            currentActive.scene.start(selectedAgent.currentScene, {
                              spawnX: selectedAgent.x + 48,
                              spawnY: selectedAgent.y,
                              fromScene: player.currentScene,
                            });
                          }
                          setPlayerCharacter(cId);
                          setCharPickerOpen(false);
                        }}
                        className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all cursor-pointer ${isSelected
                          ? 'bg-amber-950/60 border-amber-500 text-amber-200 shadow-md scale-105'
                          : 'bg-slate-800/60 border-slate-700 hover:border-slate-500 text-slate-300 hover:bg-slate-800'
                          }`}
                      >
                        <img
                          src={getCharacterAvatarUrl(cId)}
                          alt={cMeta.name}
                          className="w-8 h-8 object-contain mb-1"
                        />
                        <span className="text-[10px] font-medium leading-tight truncate w-full">
                          {cMeta.name.split(' ')[0]}
                        </span>
                        <span className="text-[8px] text-slate-400">{cMeta.role}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Floating Action Ribbon */}
      <div className="flex items-center justify-center gap-2 mt-1 pointer-events-auto">
        <div className="bg-slate-900/90 backdrop-blur-lg border border-slate-700/80 rounded-2xl p-1.5 flex items-center gap-1.5 shadow-2xl">
          {/* Propose Story */}
          <button
            onClick={() => setActivePanel(activePanel === 'story_proposal' ? 'none' : 'story_proposal')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${activePanel === 'story_proposal'
              ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/40'
              : 'bg-slate-800/80 text-sky-300 hover:bg-slate-700 hover:text-sky-200'
              }`}
          >
            <Scroll className="w-4 h-4 text-sky-400" />
            <span>Weave Story</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950/80 border border-sky-400/40 text-sky-300 font-mono">35m</span>
          </button>

          {/* Enact Law */}
          <button
            onClick={() => setActivePanel(activePanel === 'law_proposal' ? 'none' : 'law_proposal')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${activePanel === 'law_proposal'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/40'
              : 'bg-slate-800/80 text-amber-300 hover:bg-slate-700 hover:text-amber-200'
              }`}
          >
            <Scale className="w-4 h-4 text-amber-400" />
            <span>Enact Law</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-400/40 text-amber-300 font-mono">25m</span>
          </button>

          {/* Chronicles & Laws History */}
          <button
            onClick={() => setActivePanel(activePanel === 'chronicles' ? 'none' : 'chronicles')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${activePanel === 'chronicles'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40'
              : 'bg-slate-800/80 text-purple-300 hover:bg-slate-700 hover:text-purple-200'
              }`}
          >
            <BookOpen className="w-4 h-4 text-purple-400" />
            <span>Chronicles ({world.chronicles.length})</span>
          </button>

          {/* WebMCP AI Console */}
          <button
            onClick={() => setActivePanel(activePanel === 'mcp_console' ? 'none' : 'mcp_console')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${activePanel === 'mcp_console'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/40'
              : 'bg-slate-800/80 text-emerald-300 hover:bg-slate-700 hover:text-emerald-200'
              }`}
          >
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>WebMCP Tools</span>
          </button>

          {/* Agents Quick List */}
          <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-slate-700/80">
            <span className="text-[10px] text-slate-400 mr-1 flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" />
              Agents:
            </span>
            {agents.slice(0, 5).map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                title={`${agent.name} (${agent.role})`}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-sky-400 flex items-center justify-center p-0.5 transition-all cursor-pointer"
              >
                <img
                  src={getCharacterAvatarUrl(agent.characterId)}
                  alt={agent.name}
                  className="w-full h-full object-contain"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
};
