function snapshotForPersistence(state: GameStore): Omit<PersistedGameState, 'messages'> {
  return {
    player: state.player,
    agents: state.agents,
    quests: state.quests,
    dailyQuests: state.dailyQuests,
    dailyQuestDay: state.dailyQuestDay,
    world: state.world,
    // Chat is intentionally NOT persisted here: the global snapshot is shared
    // by every browser, and messages must stay session-scoped. Chat history
    // lives only in the umega_chat_messages table, filtered per session id.
    interventionRequests: state.interventionRequests,
    godMode: state.godMode,
  };
}
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
import { PERSONALITY_PROFILES } from '../constants/characters';
import { loadChronicles, loadChatMessages, loadLaws, loadMCPLogs, loadPersistedAgents, loadPersistedGameState, loadWorldEvents, realtimeBridge, saveChatMessage, saveChronicle, saveLaw, savePersistedAgents, savePersistedGameState, saveWorldEvent, supabase } from '../services/supabase';
import { getChatSessionId } from '../services/chatSession';

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

type PersistedGameState = Pick<GameStore, 'player' | 'agents' | 'quests' | 'dailyQuests' | 'dailyQuestDay' | 'world' | 'messages' | 'interventionRequests' | 'godMode'>;

function ensureLongFormStory(title: string, content: string, impact: string): string {
  if (content.trim().length >= 500 && content.includes('\n\n')) return content.trim();
  return `${content.trim()}\n\nThe change did not end when the words were spoken. Across Umegga, citizens noticed the first consequence in the places they knew best, and each witness carried a different version of the moment into the next conversation. The story gathered weight as it moved from voice to voice.\n\nBy the following dusk, ${title} had become more than an event. It had become a choice the city could remember: ${impact}`;
}

function createStartingGoal(agent: AgentState): AgentGoal {
  const role = agent.role.toLowerCase();
  let type: AgentGoal['type'] = 'gather_knowledge';
  let title = 'Study the changing city';
  let description = 'Gather knowledge about a changing part of Umegga and share what you learn.';

  if (role.includes('artisan') || role.includes('architect')) {
    type = 'build';
    title = 'Strengthen Umegga';
    description = 'Find a place where practical work can make the city safer or more useful.';
  } else if (role.includes('arbiter')) {
    type = 'enforce_law';
    title = 'Guard civic balance';
    description = 'Observe the city and uphold fair order without silencing its people.';
  } else if (role.includes('oracle')) {
    type = 'travel';
    title = 'Read the distant signs';
    description = 'Travel through the districts and bring back one useful warning or insight.';
  } else if (role.includes('botanist')) {
    type = 'protect_area';
    title = 'Tend the living roots';
    description = 'Protect a living place and keep its inhabitants safe while it grows.';
  } else if (role.includes('bard') || role.includes('minstrel')) {
    type = 'communicate';
    title = 'Keep the city connected';
    description = 'Speak with another inhabitant and strengthen a meaningful connection.';
  } else if (role.includes('merchant')) {
    type = 'support_ally';
    title = 'Build a useful alliance';
    description = 'Support an ally through a practical exchange that benefits the city.';
  } else if ((agent.personality?.traits.idealism || 0) > 0.7) {
    type = 'personality_growth';
    title = 'Turn vision into action';
    description = agent.personality?.growthFocus || 'Practice one grounded action that helps another inhabitant.';
  }

  return {
    id: `goal_${agent.id}_starting`,
    type,
    title,
    description,
    priority: 6,
    status: 'active',
    updatedAt: new Date().toISOString(),
  };
}

function normalizeAgent(agent: AgentState): AgentState {
  const goals = (agent.goals || [])
    .filter((goal) => goal.status === 'active' || goal.status === 'completed' || goal.status === 'blocked')
    .map((goal) => ({ ...goal, type: goal.type || 'gather_knowledge' }));
  return {
    ...agent,
    relationships: agent.relationships || [],
    personality: agent.personality || PERSONALITY_PROFILES[agent.characterId],
    goals: goals.some((goal) => goal.status === 'active') ? goals : [createStartingGoal(agent), ...goals],
  };
}

function normalizeWorld(world: WorldState): WorldState {
  const seenLaws = new Set<string>();
  const seenStories = new Set<string>();
  return {
    ...world,
    activeLaws: world.activeLaws.filter((law) => {
      const isAutonomousLaw = law.id.startsWith('law_agent_');
      const autonomousDay = isAutonomousLaw ? (/^\d{4}-\d{2}-\d{2}$/.test(law.passedAt) ? law.passedAt : 'legacy') : '';
      const key = isAutonomousLaw ? `${law.author}|${autonomousDay}` : `${law.author}|${law.title}|${law.edict}|${law.passedAt}`;
      if (seenLaws.has(key)) return false;
      seenLaws.add(key);
      return true;
    }),
    chronicles: world.chronicles.filter((story) => {
      const key = `${story.author}|${story.title}|${story.content}`;
      if (seenStories.has(key)) return false;
      seenStories.add(key);
      return true;
    }),
  };
}

// All persistent values live in Supabase; the store boots with defaults and
// hydrates from the remote snapshot once it arrives.
const DAILY_QUEST_POOL: Omit<Quest, 'id' | 'currentCount' | 'completed' | 'expiresAt'>[] = [
  { title: 'A Conversation Worth Keeping', description: 'Speak with an agent and leave a meaningful impression.', objective: 'Talk to any agent', targetType: 'talk', targetCount: 1, rewardMana: 30, rewardRenown: 15, category: 'core' },
  { title: 'Weather in the Words', description: 'Weave a story powerful enough to change Umegga\'s atmosphere.', objective: 'Weave a story', targetType: 'story', targetCount: 1, rewardMana: 45, rewardRenown: 20, category: 'core' },
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
const initialDailyQuests = createDailyQuests(today);

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
    description: 'Weave a new mythic chronicle to reshape the atmospheric reality of Umegga.',
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
    set((state) => {
      // Skip messages we already have (by id, or identical sender+text from a
      // cross-tab broadcast echo) so realtime never duplicates chat entries.
      if (state.messages.some((existing) => existing.id === msg.id || (existing.sender === msg.sender && existing.text === msg.text && existing.timestamp === msg.timestamp))) return {};
      return { messages: [...state.messages.slice(-50), msg] };
    });
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
    player: {
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
        SanctuaryScene: 'Umegga Central Sanctuary',
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

    quests: INITIAL_QUESTS,
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

    agents: [],
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
      const conversation = get().messages
        .filter((item) => item.channel === 'conversation' && (item.recipientAgentId === agentId || item.senderId === agentId))
        .slice(-12)
        .map((item) => ({
          role: item.senderId === agentId ? 'assistant' as const : 'user' as const,
          content: item.text,
        }));
      get().addMessage({
        sender: get().player.name,
        recipientAgentId: agentId,
        avatarId: get().player.characterId,
        text: message.trim(),
        type: 'chat',
        channel: 'conversation',
      });
      const reply = await generateAgentReply(agent, message.trim(), conversation);
      const currentAgent = get().agents.find((item) => item.id === agentId);
      if (!currentAgent) return;
      get().addMessage({
        sender: currentAgent.name,
        senderId: currentAgent.id,
        role: currentAgent.role,
        avatarId: currentAgent.characterId,
        text: reply,
        type: 'agent',
        channel: 'conversation',
      });
      set((state) => ({
        agents: state.agents.map((item) => item.id === agentId ? { ...item, currentThought: reply } : item),
      }));
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
      void saveWorldEvent('alliance', { firstId, secondId }, `alliance_${firstId}_${secondId}_${Date.now()}`).catch((error) => console.error('[Supabase] alliance event save failed:', error));
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
      void saveWorldEvent('build', structure, structure.id).catch((error) => console.error('[Supabase] build event save failed:', error));
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
      if (agent) {
        const replacement = createStartingGoal(agent);
        const { id: _goalId, updatedAt: _updatedAt, ...replacementGoal } = replacement;
        get().setAgentGoal(id, replacementGoal);
      }
      get().addAgentMemory(id, `Completed goal: ${goal?.title || goalId}.`, 7);
      get().addMessage({ sender: agent?.name || 'Agent', role: agent?.role, avatarId: agent?.characterId, text: `Goal completed: ${goal?.title || goalId}.`, type: 'agent' });
      void saveWorldEvent('goal', { agentId: id, goalId, title: goal?.title }, `goal_${id}_${goalId}_${Date.now()}`).catch((error) => console.error('[Supabase] goal event save failed:', error));
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
        void saveWorldEvent('personality', { agentId: id, change, reason }, `personality_${id}_${Date.now()}`).catch((error) => console.error('[Supabase] personality event save failed:', error));
      }
    },

    agentWeaveStory: (agentId) => {
      const agent = get().agents.find((item) => item.id === agentId);
      if (!agent || !['aelira', 'lira'].includes(agent.characterId)) return false;
      const today = dailyKey();
      if (get().world.chronicles.some((story) => story.author === agent.name && story.timestamp === today)) return false;
      const stories: Array<[string, string, string, StoryEntry['visualEffectType']]> = ([

        ['The Lanterns Remember', 'Every lantern in Umegga keeps one kindness and gives it back at dusk.\n\nLira carried this promise from door to door, asking no one for a grand gesture. A cup of water, a repaired clasp, a listening ear: each small mercy became a spark beneath the glass.\n\nWhen evening arrived, the lanterns did not merely brighten the streets. They returned those remembered acts as pools of warm light, guiding strangers toward one another.', 'Warmth gathers around shared paths.', 'golden_hour' as const],
        ['The River Learns Our Names', 'The canals carry the names of those who help the city endure.\n\nAt first the river answered only with a low, silver murmur. Then the names began to surface: the baker who fed a traveler, the mason who braced a failing bridge, the child who returned a lost compass.\n\nBy dawn, every current in Umegga knew that a city is not held together by stone alone. It is held by the stories people choose to carry for one another.', 'The atmosphere turns lucid and welcoming.', 'aurora' as const],
        ['A Song Beneath the Stone', 'There is a note beneath the oldest plaza that no instrument can play. Lira found it by sitting still while the city hurried around her.\n\nShe answered with a melody made from ordinary sounds: footsteps, shutters, breath, and the soft knock of rain. The hidden note rose to meet her, and the stones remembered how to welcome a voice.\n\nSince then, lonely corners have begun to echo with invitations instead of silence.', 'The city becomes more receptive to shared voices.', 'aurora' as const],
      ] as Array<[string, string, string, StoryEntry['visualEffectType']]>).filter(([storyTitle]) => !get().world.chronicles.some((story) => story.author === agent.name && story.title === storyTitle));
      if (stories.length === 0) return false;
      const [title, content, impact, visualEffectType] = stories[Math.floor(Math.random() * stories.length)];
      const story: StoryEntry = { id: `story_agent_${Date.now()}`, title, content, fullContent: content, author: agent.name, timestamp: today, impactSummary: impact, visualEffectType, resonance: 75 + Math.floor(Math.random() * 20), enacted: true };
      set((state) => ({ world: { ...state.world, chronicles: [story, ...state.world.chronicles], realityDistortion: Math.min(1, state.world.realityDistortion + 0.04) } }));
      get().addAgentMemory(agentId, `Wove the chronicle "${title}" into Umegga.`, 8);
      get().addAgentThought(agentId, `The words are alive: "${title}".`);
      get().evolveAgentPersonality(agentId, { idealism: 0.02, pride: 0.015 }, `Wove "${title}" and saw the city answer.`);
      get().advanceQuest('story');
      get().advanceDailyQuest('story');
      get().addMessage({ sender: agent.name, role: agent.role, avatarId: agent.characterId, text: `Chronicle woven: "${title}".`, type: 'story' });
      void saveWorldEvent('story', story, story.id).catch((error) => console.error('[Supabase] story event save failed:', error));
      void saveChronicle(story).catch((error) => console.error('[Supabase] chronicle save failed:', error));
      return true;
    },

    agentEnactLaw: (agentId) => {
      const agent = get().agents.find((item) => item.id === agentId);
      if (!agent || !['torren', 'elder_maelon'].includes(agent.characterId)) return false;
      const today = dailyKey();
      const titleCandidate = agent.personality?.traits.order && agent.personality.traits.order > 0.75 ? 'The Duty of Clear Paths' : 'The Compact of Shared Passage';
      const edictText = 'No citizen shall be left without a visible path around an obstruction.';
      if (get().world.activeLaws.some((law) => (law.author === agent.name && law.passedAt === today) || (law.author === agent.name && law.title === titleCandidate && law.edict === edictText))) return false;
      const law: LawEntry = { id: `law_agent_${Date.now()}`, title: titleCandidate, edict: edictText, author: agent.name, category: 'Civic Order', passedAt: today, active: true, effect: { type: 'agent_curiosity', magnitude: 1.15, description: 'Agents become more attentive to blocked paths and shared needs.' } };
      set((state) => ({ world: { ...state.world, activeLaws: [law, ...state.world.activeLaws] } }));
      get().addAgentMemory(agentId, `Enacted the law "${law.title}".`, 8);
      get().addAgentThought(agentId, `The decree is entered: "${law.title}".`);
      get().evolveAgentPersonality(agentId, { order: 0.02, pride: 0.015 }, `Enacted "${law.title}" for the city's safety.`);
      get().advanceQuest('law');
      get().advanceDailyQuest('law');
      get().addMessage({ sender: agent.name, role: agent.role, avatarId: agent.characterId, text: `Law enacted: "${law.title}".`, type: 'law' });
      void saveWorldEvent('law', law, law.id).catch((error) => console.error('[Supabase] law event save failed:', error));
      void saveLaw(law).catch((error) => console.error('[Supabase] law save failed:', error));
      return true;
    },

    spawnAgent: (agent: AgentState) => {
      const normalizedAgent = normalizeAgent(agent);
      set((state) => (state.agents.some((existing) => existing.id === agent.id) ? {} : { agents: [...state.agents, normalizedAgent] }));
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
      void saveWorldEvent('intervention', request, request.id).catch((error) => console.error('[Supabase] intervention event save failed:', error));
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

    world: {
      cityName: 'Umegga Sanctuary',
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
      activeLaws: [],
      chronicles: [],
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

      const narrative = ensureLongFormStory(title, content, impact);
      const newStory: StoryEntry = {
        id: 'story_' + Date.now(),
        title,
        content: narrative,
        summary: content,
        fullContent: narrative,
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
      void saveWorldEvent('story', newStory, newStory.id).catch((error) => console.error('[Supabase] story event save failed:', error));
      void saveChronicle(newStory).catch((error) => console.error('[Supabase] chronicle save failed:', error));

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
      void saveWorldEvent('law', newLaw, newLaw.id).catch((error) => console.error('[Supabase] law event save failed:', error));
      void saveLaw(newLaw).catch((error) => console.error('[Supabase] law save failed:', error));

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

    messages: [],

    interventionRequests: [],
    godMode: false,
    setGodMode: (enabled) => set({ godMode: enabled }),

    addMessage: (msg) => {
      const newMsg: ChatMessage = {
        ...msg,
        sessionId: getChatSessionId(),
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      set((state) => {
        // Drop exact duplicates (same sender + text) already visible in chat.
        if (state.messages.some((existing) => existing.sender === newMsg.sender && existing.text === newMsg.text && existing.timestamp === newMsg.timestamp)) return {};
        return { messages: [...state.messages.slice(-60), newMsg] };
      });
      if (msg.type === 'chat') {
        realtimeBridge.broadcastMessage(newMsg);
      }
      void saveChatMessage(newMsg).catch((error) => console.error('[Supabase] chat message save failed:', error));
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
      void saveWorldEvent('mcp_call', log, log.id).catch((error) => console.error('[Supabase] MCP log save failed:', error));
    },
  };
});

// Persist all domain state to Supabase so memories, goals, relationships, and
// world changes survive refreshes. Nothing is kept in the browser.
if (typeof window !== 'undefined') {
  let persistTimer: number | undefined;
  let gameStatePersistTimer: number | undefined;
  if (!supabase) {
    console.warn('[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set; game progress will not persist.');
  }
  useGameStore.subscribe((state) => {
    const snapshot = snapshotForPersistence(state);
    if (persistTimer) window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      void savePersistedAgents(state.agents).catch((error) => console.error('[Supabase] agent save failed:', error));
    }, 800);
    if (gameStatePersistTimer) window.clearTimeout(gameStatePersistTimer);
    gameStatePersistTimer = window.setTimeout(() => {
      void savePersistedGameState(snapshot).catch((error) => console.error('[Supabase] game state save failed:', error));
    }, 800);
  });

  void Promise.all([loadPersistedAgents(), loadPersistedGameState(), loadChatMessages(), loadWorldEvents(), loadChronicles(), loadLaws(), loadMCPLogs()]).then(([agents, remoteState, remoteMessages, remoteEvents, remoteChronicles, remoteLaws, remoteMCPLogs]) => {
    if (remoteState) {
      const restored = remoteState as Partial<PersistedGameState>;
      // Never restore chat from the shared snapshot: it is global state, and
      // messages must remain private to this browser's chat session.
      const { messages: _legacyMessages, ...restoredWithoutMessages } = restored as Record<string, unknown>;
      void _legacyMessages;
      useGameStore.setState({
        ...restoredWithoutMessages,
        ...(Array.isArray(restored.agents) ? { agents: restored.agents.map(normalizeAgent) } : {}),
        ...(restored.world ? {
          world: normalizeWorld({ ...restored.world, chronicles: [], activeLaws: [] }),
        } : {}),
      });
    }
    if (agents.length > 0 && !Array.isArray(remoteState?.agents)) useGameStore.setState({ agents: agents.map(normalizeAgent) });
    if (remoteMCPLogs.length > 0) useGameStore.setState({ mcpLogs: remoteMCPLogs });

    // Merge Supabase-only state that supplements the game-state snapshot.
    // Dedicated tables are authoritative for enacted stories and active laws.
    if (remoteMessages.length > 0 || remoteEvents.length > 0 || remoteChronicles.length > 0 || remoteLaws.length > 0) {
      useGameStore.setState((state) => {
        const seenMessageIds = new Set(state.messages.map((msg) => msg.id));
        const mergedMessages = [...state.messages];
        remoteMessages.forEach((msg) => {
          if (seenMessageIds.has(msg.id)) return;
          seenMessageIds.add(msg.id);
          mergedMessages.push(msg);
        });

        const seenStoryIds = new Set(state.world.chronicles.map((story) => story.id));
        const seenStoryKeys = new Set(state.world.chronicles.map((story) => `${story.author}|${story.title}`));
        const stories = [...state.world.chronicles];
        const addStory = (story: StoryEntry) => {
          if (!story?.id || seenStoryIds.has(story.id)) return;
          const key = `${story.author}|${story.title}`;
          if (seenStoryKeys.has(key)) return;
          seenStoryIds.add(story.id);
          seenStoryKeys.add(key);
          stories.unshift(story);
        };
        remoteChronicles.forEach(addStory);

        const seenLawIds = new Set(state.world.activeLaws.map((law) => law.id));
        const seenLawKeys = new Set(state.world.activeLaws.map((law) => `${law.author}|${law.title}`));
        const laws = [...state.world.activeLaws];
        const addLaw = (law: LawEntry) => {
          if (!law?.id || seenLawIds.has(law.id)) return;
          const key = `${law.author}|${law.title}`;
          if (seenLawKeys.has(key)) return;
          seenLawIds.add(law.id);
          seenLawKeys.add(key);
          laws.unshift(law);
        };
        remoteLaws.forEach(addLaw);

        return {
          messages: mergedMessages.slice(-80),
          world: normalizeWorld({ ...state.world, chronicles: stories, activeLaws: laws }),
        };
      });
    }

    const snapshot = snapshotForPersistence(useGameStore.getState());
    void savePersistedAgents(snapshot.agents).catch((error) => console.error('[Supabase] initial agent save failed:', error));
    void savePersistedGameState(snapshot).catch((error) => console.error('[Supabase] initial game state save failed:', error));

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
