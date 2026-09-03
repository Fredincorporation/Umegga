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
} from '../types/game';
import { INITIAL_AGENTS } from '../constants/characters';
import { realtimeBridge } from '../services/supabase';

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
  updateAgentPosition: (id: string, x: number, y: number, anim: AnimationType, isMoving: boolean) => void;
  moveAgentToScene: (id: string, scene: SceneKey, x: number, y: number) => void;
  addAgentThought: (id: string, thought: string) => void;
  addAgentMemory: (id: string, memoryEvent: string, importance?: number) => void;
  spawnAgent: (agent: AgentState) => void;

  // World State
  world: WorldState;
  setWeather: (weather: WeatherType) => void;
  proposeStory: (title: string, content: string, impact: string, effectType: StoryEntry['visualEffectType']) => void;
  proposeLaw: (title: string, edict: string, category: LawEntry['category'], effectType: LawEntry['effect']['type'], magnitude: number) => void;
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

const INITIAL_STORIES: StoryEntry[] = [
  {
    id: 'story_genesis',
    title: 'The Great Awakening of Umega',
    content: 'When the first words were inscribed upon the star-stone, the city materialized from sheer imagination.',
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

export const useGameStore = create<GameStore>((set, get) => {
  // Listen for real-time broadcast events from other tabs / players
  realtimeBridge.onMessage((msg) => {
    set((state) => ({ messages: [...state.messages.slice(-50), msg] }));
  });

  realtimeBridge.onStory((story) => {
    set((state) => ({
      world: {
        ...state.world,
        chronicles: [story, ...state.world.chronicles],
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
        activeLaws: [law, ...state.world.activeLaws],
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

    // Agents
    agents: INITIAL_AGENTS,
    selectedAgentId: null,

    setSelectedAgentId: (id: string | null) => {
      set({ selectedAgentId: id, activePanel: id ? 'agent_inspector' : 'none' });
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
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        event: memoryEvent,
        importance,
      };
      set((state) => ({
        agents: state.agents.map((agent) =>
          agent.id === id ? { ...agent, memory: [newMemory, ...agent.memory.slice(0, 9)] } : agent
        ),
      }));
    },

    spawnAgent: (agent: AgentState) => {
      set((state) => ({ agents: [...state.agents, agent] }));
      get().addMessage({
        sender: 'World Nexus',
        text: `New sentient agent manifested in the city: ${agent.name} (${agent.role})`,
        type: 'system',
      });
    },

    // World State
    world: {
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

      realtimeBridge.broadcastStory(newStory);

      get().addMessage({
        sender: 'Storyweaver Nexus',
        text: `📜 New Story Enacted: "${title}" – Reality shifts!`,
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
    },

    proposeLaw: (title, edict, category, effectType, magnitude) => {
      const { player } = get();
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

      realtimeBridge.broadcastLaw(newLaw);

      get().addMessage({
        sender: 'High Arbiter Council',
        text: `⚖️ Law Ratified: "${title}" (${category})`,
        type: 'law',
      });
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
    messages: [
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
      get().addMessage({
        sender: `WebMCP [${tool}]`,
        text: `Executed with ${JSON.stringify(args)} => Success`,
        type: 'mcp',
      });
    },
  };
});
