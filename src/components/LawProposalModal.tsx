import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { LawEntry } from '../types/game';
import { X, Scale, Sparkles, Shield } from 'lucide-react';

const LAW_PRESETS: Array<{
  title: string;
  edict: string;
  category: LawEntry['category'];
  effectType: LawEntry['effect']['type'];
  magnitude: number;
}> = [
    {
      title: 'Edict of Fleet Stride',
      edict: 'All denizens of Umegga are granted 35% increased traverse velocity upon the sacred paved highways.',
      category: 'Reality Edict',
      effectType: 'speed_boost',
      magnitude: 1.35,
    },
    {
      title: 'Decree of Siphoned Aether',
      edict: 'The central reservoir shall continuously siphon ambient mana, quadrupling restorative mana pulses for all beings.',
      category: 'Arcane Decree',
      effectType: 'mana_regeneration',
      magnitude: 3.0,
    },
    {
      title: 'Pact of Inquisitive Cognition',
      edict: 'Agents are mandated to inspect mysterious phenomena and share philosophical insights with travelers.',
      category: 'Cosmic Harmonization',
      effectType: 'agent_curiosity',
      magnitude: 1.5,
    },
    {
      title: 'Charter of the Radiant Spire',
      edict: 'All municipal spires and lanterns shall radiate pure mythic luminescence to ward off void storms.',
      category: 'Civic Order',
      effectType: 'radiant_glow',
      magnitude: 2.0,
    },
  ];

export const LawProposalModal: React.FC = () => {
  const { activePanel, setActivePanel, proposeLaw } = useGameStore();

  const [title, setTitle] = useState('');
  const [edict, setEdict] = useState('');
  const [category, setCategory] = useState<LawEntry['category']>('Reality Edict');
  const [effectType, setEffectType] = useState<LawEntry['effect']['type']>('speed_boost');
  const [magnitude, setMagnitude] = useState(1.3);

  if (activePanel !== 'law_proposal') return null;

  const handleApplyPreset = (preset: (typeof LAW_PRESETS)[0]) => {
    setTitle(preset.title);
    setEdict(preset.edict);
    setCategory(preset.category);
    setEffectType(preset.effectType);
    setMagnitude(preset.magnitude);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !edict.trim()) return;

    proposeLaw(title, edict, category, effectType, magnitude);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl relative text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-950 border border-amber-500/40 text-amber-400">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-fantasy font-bold text-lg text-amber-300">Enact a Civic or Arcane Law</h2>
              <p className="text-xs text-slate-400">Ratify a law to mechanically bind the physical laws of the city</p>
            </div>
          </div>
          <button
            onClick={() => setActivePanel('none')}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Presets */}
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Standard Edict Templates
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LAW_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700 hover:border-amber-400/60 text-left transition-all cursor-pointer group"
                >
                  <div className="font-medium text-slate-200 group-hover:text-amber-300 text-xs truncate">
                    {preset.title}
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{preset.edict}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Law Title & Designation
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Decree of Celestial Buoyancy"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Category & Effect */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-800/80 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="Reality Edict">Reality Edict</option>
                <option value="Arcane Decree">Arcane Decree</option>
                <option value="Civic Order">Civic Order</option>
                <option value="Cosmic Harmonization">Cosmic Harmonization</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Mechanical Effect
              </label>
              <select
                value={effectType}
                onChange={(e) => setEffectType(e.target.value as any)}
                className="w-full bg-slate-800/80 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="speed_boost">⚡ Movement Speed Boost</option>
                <option value="mana_regeneration">✨ Mana Regeneration Surge</option>
                <option value="agent_curiosity">🧠 Agent Cognition & Curiosity</option>
                <option value="radiant_glow">🌟 Radiant Sanctuary Luminescence</option>
              </select>
            </div>
          </div>

          {/* Edict Description */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Formal Law Edict
            </label>
            <textarea
              required
              rows={3}
              placeholder="State the absolute law that all inhabitants, agents, and natural phenomena must adhere to..."
              value={edict}
              onChange={(e) => setEdict(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 focus:border-amber-400 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
            />
          </div>

          {/* Magnitude Slider */}
          <div>
            <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
              <span>Effect Magnitude</span>
              <span className="text-amber-400 font-mono">{magnitude.toFixed(2)}x Multiplier</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={3.0}
              step={0.05}
              value={magnitude}
              onChange={(e) => setMagnitude(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          {/* Footer Submittal */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <Shield className="w-4 h-4" />
              <span>Ratification: +45 Mana, +35 Renown (Cost: 25 Mana)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActivePanel('none')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Scale className="w-4 h-4" />
                Ratify Law
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
