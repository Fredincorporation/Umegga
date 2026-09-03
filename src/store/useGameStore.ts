import { create } from 'zustand';
import {
  CharacterId,
  AgentState,
  PlayerState,
  WorldState,
  StoryEntry,
  LawEntry,
  ChatMessage,
  WeatherType,
  AnimationType,
  SceneKey,
  Quest,
  AgentGoal,
  AgentRelationship,
  BuiltStructure,
  InterventionRequest,
  AgentPersonality,
} from '../types/game';
import { generateAgentReply } from '../services/agentDialogue';
import { INITIAL_AGENTS, PERSONALITY_PROFILES } from '../constants/characters';
import { loadPersistedAgents, realtimeBridge, savePersistedAgents, supabase } from '../services/supabase';

interface GameStore {
  // Player
  player: PlayerState;
  setPlayerCharacter: (id: CharacterId) => void;
  setPlayerScene: (scene: SceneKey, x?: number, y?: number) => void;
  updatePlayerPosition: (x: number, y: number, anim: AnimationType, isMoving: boolean) => void;
  consumeMana: (amount: number) => boolean;
  gainMana: (amount: number) => void;

  // Agents
  agents: AgentState[];
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  engagedAgentId: string | null;
  engageAgent: (agentId: string) => void;
  endAgentEngagement: () => void;
  nearbyAgent: AgentState | null;
  setNearbyAgent: (agent: AgentState | null) => void;
  interactWithNearbyAgent: () => void;
  sendMessageToAgent: (agentId: string, message: string) => Promise<void>;
  updateAgentPosition: (id: string, x: number, y: number, anim: AnimationType, isMoving: boolean) => void;
  moveAgentToScene: (id: string, scene: SceneKey, x: number, y: number) => void;
  addAgentThought: (id: string, thought: string) => void;
  addAgentMemory: (id: string, memoryEvent: string, importance?: number) => void;
  communicateWithAgent: (fromId: string, toId: string, message: string) => void;
  formAlliance: (firstId: string, secondId: string) => boolean;
  addStructure: (structure: BuiltStructure) => boolean;
  setAgentGoal: (id: string, goal: Omit<AgentGoal, 'id' | 'updatedAt'>) => void;
  completeAgentGoal: (id: string, goalId: string) => void;
  adjustAgentRelationship: (id: string, subjectAgentId: string, affinityDelta: number, history?: string) => void;
  evolveAgentPersonality: (id: string, change: Partial<Record<keyof AgentPersonality['traits'], number>>, reason: string) => void;
  spawnAgent: (agent: AgentState) => void;
  interventionRequests: InterventionRequest[];
  requestHumanIntervention: (agentId: string, reason: string, action: string) => void;
  resolveIntervention: (requestId: string, accepted: boolean) => void;
  godMode: boolean;
  setGodMode: (enabled: boolean) => void;

  // Quests
  quests: Quest[];
  advanceQuest: (targetType: Quest['targetType'], targetId?: string) => void;
  dailyQuests: Quest[];
  dailyQuestDay: string;
  advanceDailyQuest: (targetType: Quest['targetType'] | 'alliance' | 'build' | 'intervention' | 'personality_growth', targetId?: string) => void;

  // World State
  world: WorldState;
  setWeather: (weather: WeatherType) => void;
  proposeStory: (title: string, content: string, impact: string, effectType: StoryEntry['visualEffectType']) => boolean;
  proposeLaw: (title: string, edict: string, category: LawEntry['category'], effectType: LawEntry['effect']['type'], magnitude: number) => boolean;
  agentWeaveStory: (agentId: string) => boolean;
  agentEnactLaw: (agentId: string) => boolean;
  advanceDaylight: () => void;

  // Chat & Chronicle Logs
  messages: ChatMessage[];
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;

  // UI Panels
  activePanel: 'none' | 'story_proposal' | 'law_proposal' | 'mcp_console' | 'agent_inspector' | 'chronicles' | 'world_map';
  setActivePanel: (panel: GameStore['activePanel']) => void;

  // WebMCP execution counter & logs
  mcpLogs: Array<{ id: string; tool: string; args: any; result: any; timestamp: string }>;
  logMCPCall: (tool: string, args: any, result: any) => void;
}

const PERSISTED_GAME_KEY = 'umega-game-state-v1';

type PersistedGameState = Pick<GameStore, 'player' | 'agents' | 'quests' | 'dailyQuests' | 'dailyQuestDay' | 'world' | 'messages' | 'interventionRequests' | 'godMode'>;

function getPersistedGameState(): Partial<PersistedGameState> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(PERSISTED_GAME_KEY) || '{}');
  } catch {
    return {};
  }
}

function normalizeAgent(agent: AgentState): AgentState {
  return {
    ...agent,
    goals: (agent.goals || []).map((goal) => ({ ...goal, type: goal.type || 'gather_knowledge' })),
    relationships: agent.relationships || [],
    personality: agent.personality || PERSONALITY_PROFILES[agent.characterId],
  };
}

const LONG_FORM_CHRONICLES: Record<string, string> = {
  'The Great Awakening of Umega': 'When the first words were inscribed upon the star-stone, the city materialized from sheer imagination.\n\nAelira spoke the opening sentence while the others gathered beneath the unfinished sky. Each syllable gave the void a boundary: a road where there had been silence, a fountain where there had been thirst, and a sanctuary where frightened ideas could meet without vanishing.\n\nThe city did not arrive complete. Its towers leaned toward the voices that named them, and its first lights flickered whenever the people disagreed. Maelon taught the newborn streets to remember, while Aelira learned that a story becomes real only when other lives make room for it.\n\nAt dawn, the star-stone settled into the heart of Umega. Its aether has flowed ever since, fed by every promise, argument, craft, and kindness the city chooses to keep.',
  'The Whispering Spores': 'Sylis planted the seeds of eternal memory along the stone plazas.\n\nHe had collected them from the shadow beneath the World-Root, where forgotten names gathered like fallen leaves. The seeds were small enough to hide beneath a fingernail, yet each carried the echo of a place no living map could find.\n\nWhen the first green shoots appeared, they whispered fragments of history into the paving stones. Children heard the laughter of vanished festivals. Builders remembered bridges their ancestors had never finished. Even the weeds carried lessons about surviving in cracks.\n\nSylis kept no single record of the event. Instead, he asked the citizens to become its archive, passing each memory hand to hand until the whole plaza breathed with a history no one person could own.',
  'The Lanterns Remember': 'Every lantern in Umega keeps one kindness and gives it back at dusk.\n\nLira carried this promise from door to door, asking no one for a grand gesture. A cup of water, a repaired clasp, a listening ear: each small mercy became a spark beneath the glass.\n\nWhen evening arrived, the lanterns did not merely brighten the streets. They returned those remembered acts as pools of warm light, guiding strangers toward one another.',
};

function normalizeWorld(world: WorldState): WorldState {
  const seenLaws = new Set<string>();
  const seenStories = new Set<string>();
  return {
    ...world,
    activeLaws: world.activeLaws.filter((law) => {
      const isAutonomousLaw = law.id.startsWith('law_agent_');
      const legacyAutonomousDay = isAutonomousLaw && !/^\d{4}-\d{2}-\d{2}$/.test(law.passedAt) ? 'legacy' : law.passedAt;
      const key = `${law.author}|${law.title}|${law.edict}|${legacyAutonomousDay}`;
      if (seenLaws.has(key)) return false;
      seenLaws.add(key);
      return true;
    }),
    chronicles: world.chronicles.filter((story) => {
      const key = `${story.author}|${story.title}|${story.content}`;
      if (seenStories.has(key)) return false;
      seenStories.add(key);
      return true;
    }).map((story) => story.content.length < 180 && LONG_FORM_CHRONICLES[story.title]
      ? { ...story, fullContent: LONG_FORM_CHRONICLES[story.title] }
      : story),
  };
}

const persistedState = getPersistedGameState();

const DAILY_QUEST_POOL: Omit<Quest, 'id' | 'currentCount' | 'completed' | 'expiresAt'>[] = [
  { title: 'A Conversation Worth Keeping', description: 'Speak with an agent and leave a meaningful impression.', objective: 'Talk to any agent', targetType: 'talk', targetCount: 1, rewardMana: 30, rewardRenown: 15, category: 'core' },
  { title: 'Weather in the Words', description: 'Weave a story powerful enough to change Umega\'s atmosphere.', objective: 'Weave a story', targetType: 'story', targetCount: 1, rewardMana: 45, rewardRenown: 20, category: 'core' },
  { title: 'A Law Made Visible', description: 'Enact a law and observe its consequence.', objective: 'Enact a law', targetType: 'law', targetCount: 1, rewardMana: 40, rewardRenown: 20, category: 'core' },
  { title: 'Hands That Build', description: 'Place a structure where the city needs it.', objective: 'Build a structure', targetType: 'build', targetCount: 1, rewardMana: 35, rewardRenown: 15, category: 'core' },
  { title: 'Threads of Trust', description: 'Form or witness a meaningful alliance.', objective: 'Form an alliance', targetType: 'alliance', targetCount: 1, rewardMana: 40, rewardRenown: 25, category: 'core' },
  { title: 'Beyond the Gate', description: 'Travel to another district and return with a memory.', objective: 'Travel to another scene', targetType: 'travel', targetCount: 1, rewardMana: 35, rewardRenown: 15, category: 'core' },
  { title: 'Aelira Learns Grounding', description: 'Help Aelira temper idealism with one practical outcome.', objective: 'Help an agent grow', targetType: 'personality_growth', targetAgentId: 'agent_aelira', targetCount: 1, rewardMana: 50, rewardRenown: 30, rewardRelationship: 4, category: 'personality_growth' },
  { title: 'Kaelen Shows Leniency', description: 'Encourage Kaelen to make room for mercy.', objective: 'Help an agent grow', targetType: 'personality_growth', targetAgentId: 'agent_kaelen', targetCount: 1, rewardMana: 50, rewardRenown: 30, rewardRelationship: 4, category: 'personality_growth' },
  { title: 'The Chronicler Shares', description: 'Help Sylis share knowledge instead of only recording it.', objective: 'Help an agent grow', targetType: 'personality_growth', targetAgentId: 'agent_sylis', targetCount: 1, rewardMana: 50, rewardRenown: 30, rewardRelationship: 4, category: 'personality_growth' },
  { title: 'The Pathfinder Stays', description: 'Help Veyra finish one commitment.', objective: 'Help an agent grow', targetType: 'personality_growth', targetAgentId: 'agent_veyra', targetCount: 1, rewardMana: 50, rewardRenown: 30, rewardRelationship: 4, category: 'personality_growth' },
];

function dailyKey() {
  return new Date().toISOString().slice(0, 10);
}

function createDailyQuests(day: string): Quest[] {
  const shuffled = [...DAILY_QUEST_POOL].sort(() => Math.random() - 0.5).slice(0, 7);
  return shuffled.map((quest, index) => ({
    ...quest,
    id: `daily_${day}_${index}`,
    currentCount: 0,
    completed: false,
    expiresAt: new Date(`${day}T23:59:59.999Z`).toISOString(),
  }));
}

const today = dailyKey();
const initialDailyQuests = persistedState.dailyQuestDay === today && persistedState.dailyQuests?.length
  ? persistedState.dailyQuests
  : createDailyQuests(today);

const INITIAL_STORIES: StoryEntry[] = [
  {
    id: 'story_genesis',
    title: 'The Great Awakening of Umega',
    content: 'When the first words were inscribed upon the star-stone, the city materialized from sheer imagination.',
    fullContent: LONG_FORM_CHRONICLES['The Great Awakening of Umega'],
    author: 'Aelira the Storyweaver',
    timestamp: 'Age of Dawn',
    impactSummary: 'Sanctuary created with perpetual aether flow.',
    visualEffectType: 'aurora',
    resonance: 98,
    enacted: true,
  },
  {
    id: 'story_verdant',
    title: 'The Whispering Spores',
    content: 'Sylis planted the seeds of eternal memory along the stone plazas.',
    fullContent: LONG_FORM_CHRONICLES['The Whispering Spores'],
    author: 'Sylis Verdant',
    timestamp: 'Age of Blossoms',
    impactSummary: 'Flora pulses with harmonic healing aura.',
    visualEffectType: 'verdant_bloom',
    resonance: 84,
    enacted: true,
  },
];

const INITIAL_LAWS: LawEntry[] = [
  {
    id: 'law_harmony',
    title: 'Decree of Harmonic Momentum',
    edict: 'All inhabitants shall experience enhanced kinetic grace across paved plazas.',
    author: 'Torren Justicar',
    category: 'Reality Edict',
    passedAt: 'Cycle 104',
    active: true,
    effect: {
      type: 'speed_boost',
      magnitude: 1.25,
      description: '+25% movement velocity on cobblestone paths.',
    },
  },
  {
    id: 'law_mana',
    title: 'Aether Reservoir Maintenance',
    edict: 'Raw thought energy is continuously filtered into the city core.',
    author: 'Elder Maelon',
    category: 'Arcane Decree',
    passedAt: 'Cycle 110',
    active: true,
    effect: {
      type: 'mana_regeneration',
      magnitude: 5,
      description: '+5 Mana gained per 10 seconds.',
    },
  },
];

const INITIAL_QUESTS: Quest[] = [
  {
    id: 'quest_1_maelon',
    title: 'The Awakening Discourse',
    description: 'Seek counsel from Arch-Philosopher Elder Maelon in the Central Sanctuary.',
    objective: 'Speak with Elder Maelon',
    targetType: 'talk',
    targetId: 'elder_maelon',
    targetCount: 1,
    currentCount: 0,
    completed: false,
    rewardMana: 50,
    rewardRenown: 40,
  },
  {
    id: 'quest_2_story',
    title: 'Inscribing Reality',
    description: 'Weave a new mythic chronicle to reshape the atmospheric reality of Umega.',
    objective: 'Weave 1 Mythic Story',
    targetType: 'story',
    targetCount: 1,
    currentCount: 0,
    completed: false,
    rewardMana: 60,
    rewardRenown: 50,
  },
  {
    id: 'quest_3_law',
    title: 'Decree of the Justicar',
    description: 'Ratify a new civic order or reality law into the Great Charter.',
    objective: 'Enact 1 City Law',
    targetType: 'law',
    targetCount: 1,
    currentCount: 0,
    completed: false,
    rewardMana: 50,
    rewardRenown: 45,
  },
  {
    id: 'quest_4_travel',
    title: 'Beyond the Gateway',
    description: 'Traverse through a portal to witness another district of the mythic city.',
    objective: 'Travel to a different realm',
    targetType: 'travel',
    targetCount: 1,
    currentCount: 0,
    completed: false,
    rewardMana: 40,
    rewardRenown: 35,
  },
  {
    id: 'quest_5_mcp',
    title: 'Architect of the Nexus',
    description: 'Execute an AI agent command via the WebMCP Console or document.modelContext.',
    objective: 'Trigger a WebMCP Tool',
    targetType: 'mcp',
    targetCount: 1,
    currentCount: 0,
    completed: false,
    rewardMana: 75,
    rewardRenown: 60,
  },
];

export const useGameStore = create<GameStore>((set, get) => {
  // Listen for real-time broadcast events from other tabs / players
  realtimeBridge.onMessage((msg) => {
    set((state) => ({ messages: [...state.messages.slice(-50), msg] }));
  });

  realtimeBridge.onStory((story) => {
    set((state) => ({
      world: {
        ...state.world,
        chronicles: state.world.chronicles.some((entry) => entry.id === story.id || (entry.author === story.author && entry.title === story.title && entry.content === story.content))
          ? state.world.chronicles
          : [story, ...state.world.chronicles],
        manaLevel: Math.min(1000, state.world.manaLevel + 100),
        manaByScene: {
          ...state.world.manaByScene,
          [state.player.currentScene]: Math.min(1000, state.world.manaByScene[state.player.currentScene] + 100),
        },
      },
    }));
  });

  realtimeBridge.onLaw((law) => {
    set((state) => ({
      world: {
        ...state.world,
        activeLaws: state.world.activeLaws.some((entry) => entry.id === law.id || (entry.author === law.author && entry.title === law.title && entry.edict === law.edict))
          ? state.world.activeLaws
          : [law, ...state.world.activeLaws],
      },
    }));
  });

  return {
    player: persistedState.player || {
      id: 'player_' + Math.random().toString(36).substring(2, 8),
      name: 'Player (Aelira)',
      characterId: 'aelira',
      currentScene: 'SanctuaryScene',
      x: 600,
      y: 600,
      currentAnim: 'idle',
      isMoving: false,
      mana: 250,
      renown: 50,
    },

    setPlayerCharacter: (id: CharacterId) => {
      set((state) => ({
        player: {
          ...state.player,
          characterId: id,
          name: `Player (${id.toUpperCase()})`,
        },
      }));
      get().addMessage({
        sender: 'System',
        text: `Avatar transmuted to ${id.toUpperCase()}.`,
        type: 'system',
      });
    },

    setPlayerScene: (scene: SceneKey, x?: number, y?: number) => {
      const sceneNames: Record<SceneKey, string> = {
        SanctuaryScene: 'Umega Central Sanctuary',
        OracleBasinScene: 'The Oracle Basin',
        BotanistGroveScene: 'The Botanist Grove',
        GrandForgeScene: 'The Grand Forge',
        BardsAmphitheatreScene: "The Bard's Amphitheatre",
        FrayingMarchScene: 'The Fraying March',
        OuterWastesScene: 'The Outer Wastes',
      };

      set((state) => ({
        player: {
          ...state.player,
          currentScene: scene,
          x: x !== undefined ? x : state.player.x,
          y: y !== undefined ? y : state.player.y,
        },
        world: {
          ...state.world,
          cityName: sceneNames[scene] || state.world.cityName,
        },
      }));

      get().advanceQuest('travel', scene);
      get().advanceDailyQuest('travel', scene);

      get().addMessage({
        sender: 'Nexus Gatekeeper',
        text: `Traversed through the portal into ${sceneNames[scene] || scene}.`,
        type: 'system',
      });
    },

    updatePlayerPosition: (x: number, y: number, anim: AnimationType, isMoving: boolean) => {
      set((state) => ({
        player: {
          ...state.player,
          x,
          y,
          currentAnim: anim,
          isMoving,
        },
      }));
    },

    consumeMana: (amount: number) => {
      const { player } = get();
      if (player.mana >= amount) {
        set((state) => ({
          player: { ...state.player, mana: state.player.mana - amount },
        }));
        return true;
      }
      return false;
    },

    gainMana: (amount: number) => {
      set((state) => ({
        player: { ...state.player, mana: Math.min(500, state.player.mana + amount) },
        world: {
          ...state.world,
          manaLevel: Math.min(1000, state.world.manaLevel + Math.floor(amount / 2)),
          manaByScene: {
            ...state.world.manaByScene,
            [state.player.currentScene]: Math.min(1000, state.world.manaByScene[state.player.currentScene] + Math.floor(amount / 2)),
          },
        },
      }));
    },

    // Quests
    quests: persistedState.quests || INITIAL_QUESTS,
    dailyQuests: initialDailyQuests,
    dailyQuestDay: today,

    advanceQuest: (targetType: Quest['targetType'], targetId?: string) => {
      const { quests } = get();
      let updated = false;
      const nextQuests = quests.map((q) => {
        if (q.completed) return q;
        const matchesType = q.targetType === targetType;
        const matchesId = !q.targetId || !targetId || q.targetId === targetId;
        if (matchesType && matchesId) {
          const currentCount = (q.currentCount || 0) + 1;
          const completed = currentCount >= (q.targetCount || 1);
          if (completed) {
            updated = true;
            get().gainMana(q.rewardMana);
            set((state) => ({
              player: { ...state.player, renown: state.player.renown + q.rewardRenown },
            }));
            get().addMessage({
              sender: 'Chronicle Quest',
              text: `✨ Quest Completed: "${q.title}"! (+${q.rewardMana} Mana, +${q.rewardRenown} Renown)`,
              type: 'system',
            });
          }
          return { ...q, currentCount, completed };
        }
        return q;
      });
      if (updated || JSON.stringify(nextQuests) !== JSON.stringify(quests)) {
        set({ quests: nextQuests });
      }
    },

    advanceDailyQuest: (targetType, targetId) => {
      const before = get().dailyQuests;
      const next = before.map((quest) => {
        if (quest.completed || quest.targetType !== targetType || (quest.targetAgentId && quest.targetAgentId !== targetId)) return quest;
        const currentCount = (quest.currentCount || 0) + 1;
        return { ...quest, currentCount, completed: currentCount >= (quest.targetCount || 1) };
      });
      set({ dailyQuests: next });
      next.filter((quest) => quest.completed && !before.find((old) => old.id === quest.id)?.completed).forEach((quest) => {
        get().gainMana(quest.rewardMana);
        set((state) => ({ player: { ...state.player, renown: state.player.renown + quest.rewardRenown } }));
        get().addMessage({ sender: 'Daily Chronicle', text: `Daily quest complete: ${quest.title} (+${quest.rewardMana} Mana, +${quest.rewardRenown} Renown).`, type: 'system' });
        if (quest.category === 'personality_growth' && quest.targetAgentId) {
          const growth: Record<string, Partial<Record<keyof AgentPersonality['traits'], number>>> = {
            agent_aelira: { idealism: -0.025, caution: 0.035 },
            agent_kaelen: { empathy: 0.035, caution: -0.02 },
            agent_sylis: { openness: 0.04, pride: 0.02 },
            agent_veyra: { caution: 0.025, order: 0.03 },
          };
          get().evolveAgentPersonality(quest.targetAgentId, growth[quest.targetAgentId] || { openness: 0.03 }, 'Your guidance helped me grow.');
          if (quest.rewardRelationship) get().adjustAgentRelationship(quest.targetAgentId, 'player', quest.rewardRelationship, 'The player supported my growth.');
          get().addMessage({ sender: 'Growth Chronicle', text: `${get().agents.find((agent) => agent.id === quest.targetAgentId)?.name || 'The agent'} seems more themselves than before.`, type: 'agent' });
        }
      });
    },

    // Agents
    agents: (persistedState.agents || INITIAL_AGENTS).map(normalizeAgent),
    selectedAgentId: null,
    engagedAgentId: null,
    nearbyAgent: null,

    setNearbyAgent: (agent: AgentState | null) => {
      set({ nearbyAgent: agent });
    },

    engageAgent: (agentId) => {
      const agent = get().agents.find((item) => item.id === agentId);
      if (!agent) return;
      set({ engagedAgentId: agentId });
      get().setSelectedAgentId(agentId);
      get().advanceDailyQuest('talk', agent.id);
      const greeting = agent.personality?.playerAttitude || `I am listening, traveler.`;
      get().addAgentThought(agent.id, greeting);
      get().addAgentMemory(agent.id, 'Opened a two-way conversation with the player.', 6);
    },

    endAgentEngagement: () => {
      set({ engagedAgentId: null, selectedAgentId: null, activePanel: 'none' });
    },

    interactWithNearbyAgent: () => {
      const { nearbyAgent } = get();
      if (!nearbyAgent) return;
      if (get().engagedAgentId) {
        get().endAgentEngagement();
      } else {
        get().engageAgent(nearbyAgent.id);
      }
    },

    sendMessageToAgent: async (agentId, message) => {
      const agent = get().agents.find((item) => item.id === agentId);
      if (!agent || !message.trim()) return;
      get().addMessage({
        sender: get().player.name,
        avatarId: get().player.characterId,
        text: message.trim(),
        type: 'chat',
      });
      const reply = await generateAgentReply(agent, message.trim());
      const currentAgent = get().agents.find((item) => item.id === agentId);
      if (!currentAgent) return;
      get().addMessage({
        sender: currentAgent.name,
        role: currentAgent.role,
        avatarId: currentAgent.characterId,
        text: reply,
        type: 'agent',
      });
      get().addAgentThought(agentId, reply);
      get().addAgentMemory(agentId, `Player said: "${message.trim()}"`, 6);
      get().addAgentMemory(agentId, `Replied: "${reply}"`, 6);
      get().adjustAgentRelationship(agentId, 'player', 2, 'Shared a meaningful conversation with the player.');
      get().advanceDailyQuest('talk', agentId);
      get().evolveAgentPersonality(agentId, { openness: 0.025, empathy: 0.02 }, 'A sincere conversation made me more open to the player.');
    },

    setSelectedAgentId: (id: string | null) => {
      set((state) => ({ selectedAgentId: id, engagedAgentId: id ? state.engagedAgentId : null, activePanel: id ? 'agent_inspector' : 'none' }));
      if (id) {
        const target = get().agents.find((a) => a.id === id);
        if (target) {
          get().gainMana(15);
          get().advanceQuest('talk', target.characterId);
        }
      }
    },

    updateAgentPosition: (id: string, x: number, y: number, anim: AnimationType, isMoving: boolean) => {
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id ? { ...agent, x, y, currentAnim: anim, isMoving } : agent
        ),
      }));
    },

    moveAgentToScene: (id: string, scene: SceneKey, x: number, y: number) => {
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id ? { ...agent, currentScene: scene, x, y } : agent
        ),
      }));
    },

    addAgentThought: (id: string, thought: string) => {
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id ? { ...agent, currentThought: thought } : agent
        ),
      }));
      const targetAgent = get().agents.find((a) => a.id === id);
      if (targetAgent) {
        get().addMessage({
          sender: targetAgent.name,
          role: targetAgent.role,
          avatarId: targetAgent.characterId,
          text: thought,
          type: 'agent',
        });
      }
    },

    addAgentMemory: (id: string, memoryEvent: string, importance = 5) => {
      const newMemory = {
        id: 'mem_' + Date.now(),
        timestamp: new Date().toISOString(),
        event: memoryEvent,
        importance,
      };
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id ? { ...agent, memory: [newMemory, ...agent.memory.slice(0, 9)] } : agent
        ),
      }));
    },

    communicateWithAgent: (fromId, toId, message) => {
      const sender = get().agents.find((agent) => agent.id === fromId);
      const recipient = get().agents.find((agent) => agent.id === toId);
      if (!sender || !recipient) return;
      get().addAgentMemory(fromId, `Told ${recipient.name}: ${message}`, 6);
      get().addAgentMemory(toId, `${sender.name} said: ${message}`, 6);
      get().adjustAgentRelationship(fromId, toId, 4, `Shared message: ${message}`);
      get().adjustAgentRelationship(toId, fromId, 4, `Received message: ${message}`);
      get().addMessage({
        sender: sender.name,
        senderId: sender.id,
        role: sender.role,
        avatarId: sender.characterId,
        text: message,
        type: 'agent',
      });
    },

    formAlliance: (firstId, secondId) => {
      const first = get().agents.find((agent) => agent.id === firstId);
      const second = get().agents.find((agent) => agent.id === secondId);
      if (!first || !second || first.id === second.id) return false;
      get().adjustAgentRelationship(first.id, second.id, 25, `Alliance formed with ${second.name}.`);
      get().adjustAgentRelationship(second.id, first.id, 25, `Alliance formed with ${first.name}.`);
      set((state) => ({
        agents: state.agents.map((agent) => agent.id === firstId || agent.id === secondId
          ? { ...agent, relationships: (agent.relationships || []).map((relationship) => relationship.agentId === (agent.id === firstId ? secondId : firstId) ? { ...relationship, allied: true, trust: Math.max(relationship.trust, 70) } : relationship) }
          : agent),
      }));
      get().addAgentMemory(first.id, `Formed an alliance with ${second.name}.`, 9);
      get().addAgentMemory(second.id, `Formed an alliance with ${first.name}.`, 9);
      get().evolveAgentPersonality(first.id, { openness: 0.04, empathy: 0.025 }, `An alliance with ${second.name} taught me to trust cooperation.`);
      get().evolveAgentPersonality(second.id, { openness: 0.04, empathy: 0.025 }, `An alliance with ${first.name} taught me to trust cooperation.`);
      get().advanceDailyQuest('alliance');
      get().addMessage({ sender: 'Alliance Chronicle', text: `${first.name} and ${second.name} are now ALLIED.`, type: 'system' });
      return true;
    },

    addStructure: (structure) => {
      const { player } = get();
      const cost = 25;
      if (player.mana < cost) return false;
      get().consumeMana(cost);
      set((state) => ({
        world: { ...state.world, structures: [...(state.world.structures || []), structure] },
      }));
      get().advanceQuest('build');
      get().advanceDailyQuest('build');
      get().addMessage({
        sender: 'World Architect',
        text: `${structure.name} was built in ${structure.scene}. (-${cost} Mana)`,
        type: 'system',
      });
      return true;
    },

    setAgentGoal: (id, goal) => {
      const newGoal: AgentGoal = {
        ...goal,
        id: `goal_${Date.now()}`,
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        agents: state.agents.map((agent) => agent.id === id
          ? { ...agent, goals: [newGoal, ...(agent.goals || []).filter((item) => item.status !== 'completed')] }
          : agent),
      }));
      get().addAgentMemory(id, `Set goal: ${goal.title}`, 6);
    },

    completeAgentGoal: (id, goalId) => {
      const agent = get().agents.find((item) => item.id === id);
      const goal = agent?.goals?.find((item) => item.id === goalId);
      set((state) => ({
        agents: state.agents.map((agent) => agent.id === id
          ? {
            ...agent,
            goals: (agent.goals || []).map((goal) => goal.id === goalId
              ? { ...goal, status: 'completed' as const, updatedAt: new Date().toISOString() }
              : goal),
          }
          : agent),
      }));
      get().addAgentMemory(id, `Completed goal: ${goal?.title || goalId}.`, 7);
      get().addMessage({ sender: agent?.name || 'Agent', role: agent?.role, avatarId: agent?.characterId, text: `Goal completed: ${goal?.title || goalId}.`, type: 'agent' });
      get().evolveAgentPersonality(id, { pride: 0.02, openness: 0.01 }, `Completing ${goal?.title || 'a difficult goal'} proved I can grow through practice.`);
    },

    adjustAgentRelationship: (id, subjectAgentId, affinityDelta, history) => {
      set((state) => ({
        agents: state.agents.map((agent) => {
          if (agent.id !== id) return agent;
          const relationships = [...(agent.relationships || [])];
          const existing = relationships.find((relationship) => relationship.agentId === subjectAgentId);
          const nextRelationship: AgentRelationship = {
            agentId: subjectAgentId,
            affinity: Math.max(-100, Math.min(100, (existing?.affinity || 0) + affinityDelta)),
            trust: Math.max(0, Math.min(100, (existing?.trust || 0) + Math.round(affinityDelta / 2))),
            history: history ? [...(existing?.history || []), history].slice(-10) : existing?.history || [],
          };
          return {
            ...agent,
            relationships: [nextRelationship, ...relationships.filter((relationship) => relationship.agentId !== subjectAgentId)],
          };
        }),
      }));
    },

    evolveAgentPersonality: (id, change, reason) => {
      const agent = get().agents.find((item) => item.id === id);
      if (!agent) return;
      const current = agent.personality || PERSONALITY_PROFILES[agent.characterId];
      const traits = { ...current.traits };
      let meaningful = false;
      (Object.keys(change) as Array<keyof AgentPersonality['traits']>).forEach((trait) => {
        const oldValue = traits[trait];
        const delta = Math.max(-0.08, Math.min(0.08, change[trait] || 0));
        traits[trait] = Math.max(0, Math.min(1, oldValue + delta));
        meaningful = meaningful || Math.abs(traits[trait] - oldValue) >= 0.04;
      });
      set((state) => ({ agents: state.agents.map((item) => item.id === id ? { ...item, personality: { ...current, traits } } : item) }));
      if (meaningful) {
        get().addAgentMemory(id, `I am changing: ${reason}`, 8);
        get().addMessage({ sender: agent.name, role: agent.role, avatarId: agent.characterId, text: `${agent.name} seems changed by experience: ${reason}`, type: 'agent' });
      }
    },

    agentWeaveStory: (agentId) => {
      const agent = get().agents.find((item) => item.id === agentId);
      if (!agent || !['aelira', 'lira'].includes(agent.characterId)) return false;
      const today = dailyKey();
      if (get().world.chronicles.some((story) => story.author === agent.name && story.timestamp === today)) return false;
      const stories: Array<[string, string, string, StoryEntry['visualEffectType']]> = [
        ['The Lanterns Remember', 'Every lantern in Umega keeps one kindness and gives it back at dusk.\n\nLira carried this promise from door to door, asking no one for a grand gesture. A cup of water, a repaired clasp, a listening ear: each small mercy became a spark beneath the glass.\n\nWhen evening arrived, the lanterns did not merely brighten the streets. They returned those remembered acts as pools of warm light, guiding strangers toward one another.', 'Warmth gathers around shared paths.', 'golden_hour' as const],
        ['The River Learns Our Names', 'The canals carry the names of those who help the city endure.\n\nAt first the river answered only with a low, silver murmur. Then the names began to surface: the baker who fed a traveler, the mason who braced a failing bridge, the child who returned a lost compass.\n\nBy dawn, every current in Umega knew that a city is not held together by stone alone. It is held by the stories people choose to carry for one another.', 'The atmosphere turns lucid and welcoming.', 'aurora' as const],
        ['A Song Beneath the Stone', 'There is a note beneath the oldest plaza that no instrument can play. Lira found it by sitting still while the city hurried around her.\n\nShe answered with a melody made from ordinary sounds: footsteps, shutters, breath, and the soft knock of rain. The hidden note rose to meet her, and the stones remembered how to welcome a voice.\n\nSince then, lonely corners have begun to echo with invitations instead of silence.', 'The city becomes more receptive to shared voices.', 'aurora' as const],
      ].filter(([storyTitle]) => !get().world.chronicles.some((story) => story.author === agent.name && story.title === storyTitle));
      if (stories.length === 0) return false;
      const [title, content, impact, visualEffectType] = stories[Math.floor(Math.random() * stories.length)];
      const story: StoryEntry = { id: `story_agent_${Date.now()}`, title, content, fullContent: content, author: agent.name, timestamp: today, impactSummary: impact, visualEffectType, resonance: 75 + Math.floor(Math.random() * 20), enacted: true };
      set((state) => ({ world: { ...state.world, chronicles: [story, ...state.world.chronicles], realityDistortion: Math.min(1, state.world.realityDistortion + 0.04) } }));
      get().addAgentMemory(agentId, `Wove the chronicle "${title}" into Umega.`, 8);
      get().addAgentThought(agentId, `The words are alive: "${title}".`);
      get().evolveAgentPersonality(agentId, { idealism: 0.02, pride: 0.015 }, `Wove "${title}" and saw the city answer.`);
      get().advanceQuest('story');
      get().advanceDailyQuest('story');
      get().addMessage({ sender: agent.name, role: agent.role, avatarId: agent.characterId, text: `Chronicle woven: "${title}".`, type: 'story' });
      return true;
    },

    agentEnactLaw: (agentId) => {
      const agent = get().agents.find((item) => item.id === agentId);
      if (!agent || !['torren', 'elder_maelon'].includes(agent.characterId)) return false;
      const today = dailyKey();
      if (get().world.activeLaws.some((law) => law.author === agent.name && law.passedAt === today)) return false;
      const law: LawEntry = { id: `law_agent_${Date.now()}`, title: agent.personality?.traits.order && agent.personality.traits.order > 0.75 ? 'The Duty of Clear Paths' : 'The Compact of Shared Passage', edict: 'No citizen shall be left without a visible path around an obstruction.', author: agent.name, category: 'Civic Order', passedAt: today, active: true, effect: { type: 'agent_curiosity', magnitude: 1.15, description: 'Agents become more attentive to blocked paths and shared needs.' } };
      set((state) => ({ world: { ...state.world, activeLaws: [law, ...state.world.activeLaws] } }));
      get().addAgentMemory(agentId, `Enacted the law "${law.title}".`, 8);
      get().addAgentThought(agentId, `The decree is entered: "${law.title}".`);
      get().evolveAgentPersonality(agentId, { order: 0.02, pride: 0.015 }, `Enacted "${law.title}" for the city's safety.`);
      get().advanceQuest('law');
      get().advanceDailyQuest('law');
      get().addMessage({ sender: agent.name, role: agent.role, avatarId: agent.characterId, text: `Law enacted: "${law.title}".`, type: 'law' });
      return true;
    },

    spawnAgent: (agent: AgentState) => {
      set((state) => ({ agents: [...state.agents, agent] }));
      get().addMessage({
        sender: 'World Nexus',
        text: `New sentient agent manifested in the city: ${agent.name} (${agent.role})`,
        type: 'system',
      });
    },

    requestHumanIntervention: (agentId, reason, action) => {
      const agent = get().agents.find((item) => item.id === agentId);
      if (!agent) return;
      const request: InterventionRequest = {
        id: `intervention_${Date.now()}`,
        agentId,
        reason,
        action,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      set((state) => ({ interventionRequests: [request, ...state.interventionRequests.filter((item) => item.status === 'pending')] }));
      get().addAgentThought(agentId, `I need your guidance: ${reason}`);
      get().addAgentMemory(agentId, `Requested human intervention: ${reason}`, 9);
      get().addMessage({
        sender: agent.name,
        role: agent.role,
        avatarId: agent.characterId,
        text: `I request your guidance. ${reason} ${action}`,
        type: 'agent',
      });
      get().advanceQuest('intervention', agentId);
      get().advanceDailyQuest('intervention', agentId);
    },

    resolveIntervention: (requestId, accepted) => {
      const request = get().interventionRequests.find((item) => item.id === requestId);
      if (!request) return;
      set((state) => ({
        interventionRequests: state.interventionRequests.map((item) => item.id === requestId
          ? { ...item, status: accepted ? 'accepted' : 'ignored' }
          : item),
      }));
      if (accepted) {
        get().setSelectedAgentId(request.agentId);
        get().addAgentMemory(request.agentId, `Human accepted intervention: ${request.action}`, 8);
      }
    },

    // World State
    world: persistedState.world ? normalizeWorld(persistedState.world) : {
      cityName: 'Umega Sanctuary',
      manaLevel: 450,
      manaByScene: {
        SanctuaryScene: 450,
        OracleBasinScene: 620,
        BotanistGroveScene: 780,
        GrandForgeScene: 390,
        BardsAmphitheatreScene: 560,
        FrayingMarchScene: 210,
        OuterWastesScene: 120,
      },
      weather: 'clear',
      worldAuraColor: '#38bdf8',
      activeLaws: INITIAL_LAWS,
      chronicles: INITIAL_STORIES,
      timeOfDay: 1200,
      realityDistortion: 0.15,
      structures: [],
    },

    setWeather: (weather: WeatherType) => {
      let auraColor = '#38bdf8';
      if (weather === 'aether_storm') auraColor = '#a855f7';
      if (weather === 'aurora') auraColor = '#34d399';
      if (weather === 'golden_hour') auraColor = '#f59e0b';
      if (weather === 'eclipse') auraColor = '#818cf8';

      set((state) => ({
        world: { ...state.world, weather, worldAuraColor: auraColor },
      }));
      get().addMessage({
        sender: 'Cosmic Firmament',
        text: `Weather transmuted to: ${weather.toUpperCase().replace('_', ' ')}`,
        type: 'system',
      });
    },

    proposeStory: (title, content, impact, effectType) => {
      const { player } = get();
      const manaCost = 35;
      if (player.mana < manaCost) {
        get().addMessage({
          sender: 'Nexus Ward',
          text: `⚠️ Insufficient Mana (${player.mana}/${manaCost}). Converse with agents or allow passive aether to recover.`,
          type: 'system',
        });
        return false;
      }
      get().consumeMana(manaCost);

      const newStory: StoryEntry = {
        id: 'story_' + Date.now(),
        title,
        content,
        author: player.name,
        timestamp: 'Present Epoch',
        impactSummary: impact,
        visualEffectType: effectType,
        resonance: Math.floor(Math.random() * 30) + 70,
        enacted: true,
      };

      set((state) => ({
        world: {
          ...state.world,
          chronicles: [newStory, ...state.world.chronicles],
          manaLevel: Math.min(1000, state.world.manaLevel + 75),
          realityDistortion: Math.min(1.0, state.world.realityDistortion + 0.08),
        },
        player: { ...state.player, renown: state.player.renown + 25 },
        activePanel: 'none',
      }));

      get().gainMana(60);
      get().advanceQuest('story');
      get().advanceDailyQuest('story');
      get().agents.forEach((agent) => {
        get().addAgentMemory(agent.id, `Experienced the story "${title}".`, 7);
        get().evolveAgentPersonality(agent.id, agent.personality?.traits.idealism && agent.personality.traits.idealism > 0.65
          ? { idealism: 0.025, openness: 0.015 }
          : { curiosity: 0.02 }, `The story "${title}" changed how I see the world.`);
        get().addAgentThought(agent.id, agent.personality?.eventReactions.stories || `I witnessed the story "${title}".`);
      });

      realtimeBridge.broadcastStory(newStory);

      get().addMessage({
        sender: 'Storyweaver Nexus',
        text: `📜 New Story Enacted: "${title}" – Reality shifts! (+60 Mana, +25 Renown)`,
        type: 'story',
      });

      // Agents react to the story
      setTimeout(() => {
        const { agents } = get();
        if (agents.length > 0) {
          const reactingAgent = agents[Math.floor(Math.random() * agents.length)];
          const thoughts = [
            `I feel the words of "${title}" vibrating through the stones!`,
            `The aether tastes sweeter since "${title}" was chronicled.`,
            `"${title}" will redefine our trade agreements.`,
            `I must document the cosmic resonance of this story!`,
          ];
          const thought = thoughts[Math.floor(Math.random() * thoughts.length)];
          get().addAgentThought(reactingAgent.id, thought);
          get().addAgentMemory(reactingAgent.id, `Witnessed story enactment: "${title}"`, 8);
        }
      }, 1200);

      return true;
    },

    proposeLaw: (title, edict, category, effectType, magnitude) => {
      const { player } = get();
      const manaCost = 25;
      if (get().world.activeLaws.some((law) => law.author === player.name && law.title === title && law.edict === edict)) {
        get().addMessage({ sender: 'High Arbiter', text: `The law "${title}" is already active.`, type: 'system' });
        return false;
      }
      if (player.mana < manaCost) {
        get().addMessage({
          sender: 'High Arbiter',
          text: `⚠️ Insufficient Mana (${player.mana}/${manaCost}) to ratify a city law.`,
          type: 'system',
        });
        return false;
      }
      get().consumeMana(manaCost);

      const newLaw: LawEntry = {
        id: 'law_' + Date.now(),
        title,
        edict,
        author: player.name,
        category,
        passedAt: 'Cycle ' + (Math.floor(Math.random() * 50) + 120),
        active: true,
        effect: {
          type: effectType,
          magnitude,
          description: `${effectType.replace('_', ' ')} altered by ${magnitude}x`,
        },
      };

      set((state) => ({
        world: {
          ...state.world,
          activeLaws: [newLaw, ...state.world.activeLaws],
          manaLevel: Math.min(1000, state.world.manaLevel + 50),
          manaByScene: {
            ...state.world.manaByScene,
            [state.player.currentScene]: Math.min(1000, state.world.manaByScene[state.player.currentScene] + 50),
          },
        },
        player: { ...state.player, renown: state.player.renown + 35 },
        activePanel: 'none',
      }));

      get().gainMana(45);
      get().advanceQuest('law');
      get().advanceDailyQuest('law');
      get().agents.forEach((agent) => {
        get().addAgentMemory(agent.id, `Witnessed the law "${title}".`, 7);
        get().evolveAgentPersonality(agent.id, agent.personality?.traits.order && agent.personality.traits.order > 0.65
          ? { order: 0.025, caution: 0.015 }
          : { openness: -0.015 }, `The law "${title}" reshaped my priorities.`);
        get().addAgentThought(agent.id, agent.personality?.eventReactions.laws || `I am considering the law "${title}".`);
      });

      realtimeBridge.broadcastLaw(newLaw);

      get().addMessage({
        sender: 'High Arbiter Council',
        text: `⚖️ Law Ratified: "${title}" (${category}) (+45 Mana, +35 Renown)`,
        type: 'law',
      });

      return true;
    },

    advanceDaylight: () => {
      set((state) => ({
        world: {
          ...state.world,
          timeOfDay: (state.world.timeOfDay + 300) % 2400,
        },
      }));
    },

    // Chat
    messages: persistedState.messages || [
      {
        id: 'msg_welcome',
        sender: 'Elder Maelon',
        role: 'Arch-Philosopher',
        avatarId: 'elder_maelon',
        text: 'Welcome, traveler, to Umega. Here, the stories you weave and decrees you enact physically reshape the sanctuary.',
        timestamp: 'Just now',
        type: 'agent',
      },
    ],

    interventionRequests: persistedState.interventionRequests || [],
    godMode: persistedState.godMode || false,
    setGodMode: (enabled) => set({ godMode: enabled }),

    addMessage: (msg) => {
      const newMsg: ChatMessage = {
        ...msg,
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      set((state) => ({
        messages: [...state.messages.slice(-60), newMsg],
      }));
      if (msg.type === 'chat') {
        realtimeBridge.broadcastMessage(newMsg);
      }
    },

    // UI Panels
    activePanel: 'none',
    setActivePanel: (panel) => set({ activePanel: panel }),

    // WebMCP
    mcpLogs: [],
    logMCPCall: (tool, args, result) => {
      const log = {
        id: 'mcp_' + Date.now(),
        tool,
        args,
        result,
        timestamp: new Date().toLocaleTimeString(),
      };
      set((state) => ({ mcpLogs: [log, ...state.mcpLogs.slice(0, 30)] }));
      get().advanceQuest('mcp', tool);
      get().addMessage({
        sender: `WebMCP [${tool}]`,
        text: `Executed with ${JSON.stringify(args)} => Success`,
        type: 'mcp',
      });
    },
  };
});

// Persist domain state locally so memories, goals, relationships, and world changes survive refreshes.
if (typeof window !== 'undefined') {
  let persistTimer: number | undefined;
  useGameStore.subscribe((state) => {
    const snapshot: PersistedGameState = {
      player: state.player,
      agents: state.agents,
      quests: state.quests,
      dailyQuests: state.dailyQuests,
      dailyQuestDay: state.dailyQuestDay,
      world: state.world,
      messages: state.messages,
      interventionRequests: state.interventionRequests,
      godMode: state.godMode,
    };
    localStorage.setItem(PERSISTED_GAME_KEY, JSON.stringify(snapshot));
    if (supabase) {
      if (persistTimer) window.clearTimeout(persistTimer);
      persistTimer = window.setTimeout(() => {
        void savePersistedAgents(state.agents);
      }, 800);
    }
  });

  void loadPersistedAgents().then((agents) => {
    if (agents.length > 0) useGameStore.setState({ agents: agents.map(normalizeAgent) });
  });
}

// Passive mana regeneration from active laws
if (typeof window !== 'undefined') {
  let lastAgentActionAt = 0;
  window.setInterval(() => {
    const state = useGameStore.getState();
    const day = dailyKey();
    if (state.dailyQuestDay !== day) {
      useGameStore.setState({ dailyQuestDay: day, dailyQuests: createDailyQuests(day) });
    }
    const { world, player, gainMana } = useGameStore.getState();
    const regenLaw = world.activeLaws.find((law) => law.active && law.effect.type === 'mana_regeneration');
    if (regenLaw && player.mana < 500) {
      gainMana(Math.round(regenLaw.effect.magnitude || 5));
    }
    if (Date.now() - lastAgentActionAt >= 18000) {
      lastAgentActionAt = Date.now();
      const currentState = useGameStore.getState();
      const today = dailyKey();
      const actor = currentState.agents.find((agent) => ['aelira', 'lira', 'torren', 'elder_maelon'].includes(agent.characterId) && !currentState.world.chronicles.some((story) => story.author === agent.name && story.timestamp === today) && !currentState.world.activeLaws.some((law) => law.author === agent.name && law.passedAt === today));
      if (actor) {
        const acted = currentState.agentWeaveStory(actor.id) || currentState.agentEnactLaw(actor.id);
        if (!acted && actor.personality?.growthFocus) {
          currentState.addAgentThought(actor.id, `I am practicing how to ${actor.personality.growthFocus.toLowerCase()}.`);
          currentState.addAgentMemory(actor.id, `Reflected on growth: ${actor.personality.growthFocus}.`, 6);
          currentState.evolveAgentPersonality(actor.id, { openness: 0.015, caution: -0.01 }, `I committed to ${actor.personality.growthFocus.toLowerCase()}.`);
        }
      }
    }
  }, 10000);
}
