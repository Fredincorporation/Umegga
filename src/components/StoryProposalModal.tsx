import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { StoryEntry } from '../types/game';
import { X, Sparkles, Scroll } from 'lucide-react';

const STORY_PRESETS: Array<{
  title: string;
  content: string;
  impact: string;
  effectType: StoryEntry['visualEffectType'];
}> = [
    {
      title: 'The Great Sunforge Awakening',
      content: 'Deep beneath the Artisan Quarter, Kaelen struck an ancient chord upon the anvil. The star-ore erupted into perpetual crystalline sunlight, illuminating every stone in the sanctuary.',
      impact: 'Increases citywide mana regeneration and charges all street lanterns with gold light.',
      effectType: 'flame_ward',
    },
    {
      title: 'The Celestial Starlight Stream',
      content: 'Aelira looked into the upper atmosphere and spoke a single ancient phrase. The night sky broke open into cascading ribbons of luminous sapphire aurora.',
      impact: 'Enables high kinetic momentum and inspires agents with profound visions.',
      effectType: 'aurora',
    },
    {
      title: 'The Blossoming of the World-Root',
      content: 'Sylis touched the cold cobblestones, commanding life to take hold. Emerald moss and glowing spirit flowers burst forth across all thoroughfares.',
      impact: 'Enhances agent emotional serenity and increases affinity bonuses.',
      effectType: 'verdant_bloom',
    },
    {
      title: 'The Whispering Eclipse',
      content: 'Veyra unlocked the nexus seal, aligning the twin moons over Umega. The city fell into a hypnotic silence where secret arcane truths became audible.',
      impact: 'Doubles psychic resonance of all agents and triggers cosmic divination.',
      effectType: 'celestial_eclipse',
    },
  ];

export const StoryProposalModal: React.FC = () => {
  const { activePanel, setActivePanel, proposeStory } = useGameStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [impact, setImpact] = useState('');
  const [effectType, setEffectType] = useState<StoryEntry['visualEffectType']>('aurora');

  if (activePanel !== 'story_proposal') return null;

  const handleApplyPreset = (preset: (typeof STORY_PRESETS)[0]) => {
    setTitle(preset.title);
    setContent(preset.content);
    setImpact(preset.impact);
    setEffectType(preset.effectType);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    proposeStory(title, content, impact || 'Reality permanently shifts to reflect the spoken tale.', effectType);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-xl bg-slate-900 border border-sky-500/40 rounded-3xl p-6 shadow-2xl relative text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-950 border border-sky-500/40 text-sky-400">
              <Scroll className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-fantasy font-bold text-lg text-sky-300">Weave a Mythic Chronicle</h2>
              <p className="text-xs text-slate-400">Inscribe a story into the tapestry of Umega to reshape reality</p>
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
              Inspiration Presets (Quick Fill)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {STORY_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700 hover:border-sky-400/60 text-left transition-all cursor-pointer group"
                >
                  <div className="font-medium text-slate-200 group-hover:text-sky-300 text-xs truncate">
                    {preset.title}
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{preset.impact}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Chronicle Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. The Dance of the Celestial Spires"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 focus:border-sky-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          {/* Narrative Content */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              The Tale & Proclamation
            </label>
            <textarea
              required
              rows={4}
              placeholder="Describe what occurred, who witnessed it, and why this event permanently alters the reality of Umega..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 focus:border-sky-400 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
            />
          </div>

          {/* Impact & Phenomenon */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Visual Phenomenon
              </label>
              <select
                value={effectType}
                onChange={(e) => setEffectType(e.target.value as any)}
                className="w-full bg-slate-800/80 border border-slate-700 focus:border-sky-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="aurora">🌌 Mythic Aurora</option>
                <option value="crystal_growth">💎 Crystal Condensation</option>
                <option value="flame_ward">🔥 Sunforge Flame</option>
                <option value="verdant_bloom">🌿 Verdant Bloom</option>
                <option value="celestial_eclipse">🌑 Celestial Eclipse</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Manifested Impact
              </label>
              <input
                type="text"
                placeholder="e.g. Increased aether surge across all plazas"
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 focus:border-sky-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Submittal */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span>Weaving Reward: +60 Mana, +25 Renown (Cost: 35 Mana)</span>
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
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-lg shadow-sky-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Scroll className="w-4 h-4" />
                Enact Chronicle
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
