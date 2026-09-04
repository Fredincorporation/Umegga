/**
 * WebMCP - Model Context Protocol Browser Integration
 * Exposes document.modelContext.registerTool for AI agents & LLM controllers.
 */

import { useGameStore } from '../store/useGameStore';
import { CharacterId, WeatherType, SceneKey, BuiltStructure, AgentState, AgentGoal } from '../types/game';

const SCENE_KEYS: readonly SceneKey[] = [
  'SanctuaryScene',
  'OracleBasinScene',
  'BotanistGroveScene',
  'GrandForgeScene',
  'BardsAmphitheatreScene',
  'FrayingMarchScene',
  'OuterWastesScene',
];

function readScene(args: { scene?: unknown; targetScene?: unknown }): SceneKey {
  const requestedScene = args.scene ?? args.targetScene;
  if (typeof requestedScene !== 'string' || !SCENE_KEYS.includes(requestedScene as SceneKey)) {
    throw new Error(`Invalid scene. Expected one of: ${SCENE_KEYS.join(', ')}.`);
  }
  return requestedScene as SceneKey;
}

function readCoordinate(value: unknown, name: string, fallback?: number): number | undefined {
  if (value === undefined || value === null) {
    if (fallback !== undefined) return fallback;
    return undefined; // optional coordinate
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a finite number.`);
  return value;
}

export interface WebMCPContext {
  tools: Map<string, any>;
  registerTool: (tool: {
    name: string;
    description: string;
    parameters?: any;
    execute: (args: any) => Promise<any> | any;
  }) => void;
  getTools: () => any[];
  callTool: (name: string, args: any) => Promise<any>;
}

declare global {
  interface Document {
    modelContext?: WebMCPContext;
  }
  interface Window {
    modelContext?: WebMCPContext;
    UmeggaMCP?: WebMCPContext;
  }
}

export function initWebMCP() {
  const toolsMap = new Map<string, any>();

  const commandAgentMove = (agentId: string, x: number, y: number) => {
    const game = typeof window !== 'undefined' ? (window as any).gameInstance : undefined;
    if (!game) return false;
    const agent = useGameStore.getState().agents.find((item) => item.id === agentId);
    const scene = game.scene.getScenes(true).find((item: any) => item.scene.key === agent?.currentScene) as any;
    const entity = scene?.agents?.get(agentId);
    if (!entity?.setTargetDestination) return false;
    entity.setTargetDestination(x, y);
    return true;
  };

  const modelContext: WebMCPContext = {
    tools: toolsMap,
    registerTool: (tool) => {
      toolsMap.set(tool.name, tool);
      console.log(`[WebMCP] Registered tool: ${tool.name}`);
      mirrorToolToStandardContext(tool);
    },
    getTools: () => {
      return Array.from(toolsMap.values()).map(({ name, description, parameters }) => ({
        name,
        description,
        parameters,
      }));
    },
    callTool: async (name, args) => {
      const tool = toolsMap.get(name);
      if (!tool) {
        throw new Error(`WebMCP tool "${name}" not found.`);
      }
      try {
        const result = await tool.execute(args);
        useGameStore.getState().logMCPCall(name, args, result);
        return result;
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        useGameStore.getState().logMCPCall(name, args, { error: errorMsg });
        throw err;
      }
    },
  };

  // Attach to document and window per WebMCP specification, and mirror every
  // tool onto the standard navigator.modelContext API so Chrome's built-in
  // WebMCP implementation (chrome://flags/#enable-webmcp-testing, Chrome 149+)
  // can discover and invoke the same tools.
  //
  // IMPORTANT: with the Chrome flag enabled, document/window.modelContext may
  // be implemented as read-only native getters. A bare assignment would throw
  // a TypeError in strict-mode module code and crash React's render tree
  // (blank page). All global attachment is therefore guarded.
  const safeAttach = (target: any, key: string, value: unknown) => {
    if (!target) return false;
    try {
      target[key] = value;
      return true;
    } catch {
      try {
        Object.defineProperty(target, key, { value, configurable: true, writable: true });
        return true;
      } catch (err) {
        console.warn(`[WebMCP] Could not attach modelContext to ${key}:`, err);
        return false;
      }
    }
  };

  if (typeof document !== 'undefined') safeAttach(document, 'modelContext', modelContext);
  if (typeof window !== 'undefined') {
    safeAttach(window, 'modelContext', modelContext);
    safeAttach(window, 'UmeggaMCP', modelContext);
  }

  // If the native WebMCP API appears later (e.g. the user enabled the Chrome
  // flag without a restart, or an extension injects it), re-mirror every tool
  // that was registered on our shim up to that point.
  const mirrorAllToStandardContext = () => {
    toolsMap.forEach((tool) => mirrorToolToStandardContext(tool));
  };
  let nativePollCount = 0;
  const nativePoll = setInterval(() => {
    nativePollCount += 1;
    try {
      const ctx = (navigator as unknown as { modelContext?: StandardModelContext }).modelContext;
      if (ctx && typeof ctx.registerTool === 'function' && ctx !== (standardContext as unknown)) {
        standardContext = ctx;
        console.log('[WebMCP] Native navigator.modelContext appeared — mirroring existing tools.');
        mirrorAllToStandardContext();
        clearInterval(nativePoll);
      }
    } catch {
      /* keep polling quietly */
    }
    if (nativePollCount > 30) clearInterval(nativePoll); // stop after ~30s
  }, 1000);

  interface StandardModelContext {
    registerTool?: (tool: any) => any;
  }
  // Merely touching navigator.modelContext is safe, but guard anyway so no
  // getter side-effect from the experimental implementation can break init.
  let standardContext: StandardModelContext | undefined;
  try {
    standardContext =
      typeof navigator !== 'undefined'
        ? (navigator as unknown as { modelContext?: StandardModelContext }).modelContext
        : undefined;
  } catch (err) {
    console.warn('[WebMCP] navigator.modelContext is not accessible:', err);
    standardContext = undefined;
  }
  if (standardContext && typeof standardContext.registerTool === 'function') {
    console.log('[WebMCP] Native navigator.modelContext detected — tools will be mirrored to Chrome WebMCP.');
  } else {
    console.log(
      '[WebMCP] Native navigator.modelContext NOT available. ' +
        'Enable chrome://flags/#enable-webmcp-testing (Chrome 140+) and reload. ' +
        'Tools are still available via window.UmeggaMCP / document.modelContext.'
    );
  }

  const mirrorToolToStandardContext = (tool: { name: string; description: string; parameters?: any; execute: (args: any) => any }) => {
    if (!standardContext || typeof standardContext.registerTool !== 'function') return;
    try {
      standardContext.registerTool({
        name: tool.name,
        title: tool.name,
        description: tool.description,
        inputSchema: tool.parameters ?? { type: 'object', properties: {} },
        execute: async ({ arguments: args }: { arguments?: any }) => tool.execute(args ?? {}),
      });
      console.log(`[WebMCP] Mirrored tool to navigator.modelContext: ${tool.name}`);
    } catch (err) {
      console.warn(`[WebMCP] Could not mirror tool "${tool.name}" to navigator.modelContext:`, err);
    }
  };

  // Register Standard Game Tools

  // 1. propose_story
  modelContext.registerTool({
    name: 'propose_story',
    description: 'Proposes a new mythic story that manifests in the city of Umegga and shifts the reality distortion.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the chronicle or tale' },
        content: { type: 'string', description: 'The narrative text explaining what happened or what reality will adopt' },
        impact: { type: 'string', description: 'The mechanical and visual impact on the world' },
        visualEffect: {
          type: 'string',
          enum: ['aurora', 'crystal_growth', 'flame_ward', 'verdant_bloom', 'celestial_eclipse'],
          description: 'The visual phenomenon triggered in the sky/ground',
        },
      },
      required: ['title', 'content', 'impact'],
    },
    execute: async (args: { title: string; content: string; impact: string; visualEffect?: any }) => {
      const effect = args.visualEffect || 'aurora';
      useGameStore.getState().proposeStory(args.title, args.content, args.impact, effect);
      return {
        success: true,
        message: `Story "${args.title}" successfully woven into reality.`,
        resonance: 92,
      };
    },
  });

  // 2. propose_law
  modelContext.registerTool({
    name: 'propose_law',
    description: 'Ratifies a new civic or arcane law affecting city physics, mana, or agent behaviors.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the law' },
        edict: { type: 'string', description: 'Exact law edict text' },
        category: {
          type: 'string',
          enum: ['Reality Edict', 'Arcane Decree', 'Civic Order', 'Cosmic Harmonization'],
          description: 'Category of the law',
        },
        effectType: {
          type: 'string',
          enum: ['speed_boost', 'mana_regeneration', 'agent_curiosity', 'radiant_glow', 'gravitational_lightness'],
          description: 'Type of reality modifier',
        },
        magnitude: { type: 'number', description: 'Magnitude multiplier (e.g. 1.25)' },
      },
      required: ['title', 'edict', 'category', 'effectType'],
    },
    execute: async (args: any) => {
      useGameStore.getState().proposeLaw(
        args.title,
        args.edict,
        args.category || 'Reality Edict',
        args.effectType || 'speed_boost',
        args.magnitude || 1.3
      );
      return {
        success: true,
        message: `Law "${args.title}" active in the Great Charter.`,
      };
    },
  });

  // 3. query_world_state
  modelContext.registerTool({
    name: 'query_world_state',
    description: 'Returns the current state of the city including mana level, active laws, chronicles, and weather.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const state = useGameStore.getState();
      return {
        world: state.world,
        player: state.player,
        agentCount: state.agents.length,
        agents: state.agents.map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role,
          position: { x: Math.round(a.x), y: Math.round(a.y) },
          status: a.status,
          currentThought: a.currentThought,
          goals: a.goals || [],
          relationships: a.relationships || [],
          memoryCount: a.memory.length,
        })),
      };
    },
  });

  modelContext.registerTool({
    name: 'get_agent_state',
    description: 'Returns an agent with its persistent memories, active goals, and relationships.',
    parameters: {
      type: 'object',
      properties: { agentId: { type: 'string', description: 'Agent ID' } },
      required: ['agentId'],
    },
    execute: async (args: { agentId: string }) => {
      const agent = useGameStore.getState().agents.find((item) => item.id === args.agentId);
      if (!agent) throw new Error(`Agent with ID "${args.agentId}" not found.`);
      return { success: true, agent };
    },
  });

  modelContext.registerTool({
    name: 'set_agent_goal',
    description: 'Assigns a durable goal to an agent so autonomous behavior can pursue it.',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID' },
        title: { type: 'string', description: 'Goal title' },
        goalType: { type: 'string', description: 'Goal type' },
        description: { type: 'string', description: 'Goal details' },
        priority: { type: 'number', description: 'Priority from 1 to 10' },
        targetAgentId: { type: 'string', description: 'Optional agent to approach' },
      },
      required: ['agentId', 'title', 'description'],
    },
    execute: async (args: { agentId: string; title: string; description: string; goalType?: string; priority?: number; targetAgentId?: string }) => {
      const state = useGameStore.getState();
      if (!state.agents.some((agent) => agent.id === args.agentId)) throw new Error(`Agent with ID "${args.agentId}" not found.`);
      if (args.targetAgentId && !state.agents.some((agent) => agent.id === args.targetAgentId)) throw new Error('Target agent does not exist.');
      state.setAgentGoal(args.agentId, {
        title: args.title,
        type: (args.goalType || 'gather_knowledge') as AgentGoal['type'],
        description: args.description,
        priority: Math.max(1, Math.min(10, args.priority ?? 5)),
        status: 'active',
        targetAgentId: args.targetAgentId,
      });
      return { success: true, agentId: args.agentId, goal: args.title };
    },
  });

  // 4. spawn_agent
  modelContext.registerTool({
    name: 'spawn_agent',
    description: 'Spawns a new AI agent character into the city at specified coordinates.',
    parameters: {
      type: 'object',
      properties: {
        characterId: {
          type: 'string',
          enum: ['aelira', 'torren', 'kaelen', 'veyra', 'orthas', 'sylis', 'lira', 'elder_maelon', 'vance'],
          description: 'Sprite template for the character',
        },
        name: { type: 'string', description: 'Name of the agent' },
        role: { type: 'string', description: 'Role or occupation in the city' },
        x: { type: 'number', description: 'X coordinate (100 - 900)' },
        y: { type: 'number', description: 'Y coordinate (100 - 900)' },
      },
      required: ['characterId', 'name', 'role'],
    },
    execute: async (args: { characterId: CharacterId; name: string; role: string; x?: number; y?: number }) => {
      const x = args.x ?? Math.floor(Math.random() * 400 + 200);
      const y = args.y ?? Math.floor(Math.random() * 400 + 200);

      const newAgent = {
        id: 'agent_' + Date.now(),
        characterId: args.characterId,
        name: args.name,
        role: args.role,
        x,
        y,
        currentAnim: 'idle' as const,
        isMoving: false,
        status: 'Pondering reality' as const,
        currentThought: `I have stepped into Umegga as ${args.role}.`,
        currentScene: 'SanctuaryScene' as const,
        affinityWithPlayer: 50,
        manaAffinity: 'Harmonic Synthesis',
        memory: [{ id: 'm_init', timestamp: 'Just now', event: `Spawned into the city.`, importance: 8 }],
      };

      useGameStore.getState().spawnAgent(newAgent);
      return { success: true, agent: newAgent };
    },
  });

  // 5. move_agent
  modelContext.registerTool({
    name: 'move_agent',
    description: 'Commands an agent to move towards target coordinates.',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'ID of the agent to move' },
        x: { type: 'number', description: 'Target X coordinate' },
        y: { type: 'number', description: 'Target Y coordinate' },
      },
      required: ['agentId', 'x', 'y'],
    },
    execute: async (args: { agentId: string; x: number; y: number }) => {
      const agent = useGameStore.getState().agents.find((a) => a.id === args.agentId);
      if (!agent) {
        throw new Error(`Agent with ID "${args.agentId}" not found.`);
      }
      const visualCommandAccepted = commandAgentMove(args.agentId, args.x, args.y);
      useGameStore.getState().addAgentThought(args.agentId, `Travelling to coordinate (${args.x}, ${args.y}).`);
      return { success: true, agentId: args.agentId, target: { x: args.x, y: args.y }, visualCommandAccepted };
    },
  });

  modelContext.registerTool({
    name: 'move',
    description: 'Moves an agent to target coordinates and records the command.',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'ID of the agent to move' },
        x: { type: 'number', description: 'Target X coordinate' },
        y: { type: 'number', description: 'Target Y coordinate' },
      },
      required: ['agentId', 'x', 'y'],
    },
    execute: async (args: { agentId: string; x: number; y: number }) => {
      const state = useGameStore.getState();
      if (!state.agents.some((agent) => agent.id === args.agentId)) throw new Error(`Agent with ID "${args.agentId}" not found.`);
      const visualCommandAccepted = commandAgentMove(args.agentId, args.x, args.y);
      state.addAgentThought(args.agentId, `Moving toward (${args.x}, ${args.y}).`);
      return { success: true, agentId: args.agentId, target: { x: args.x, y: args.y }, visualCommandAccepted };
    },
  });

  modelContext.registerTool({
    name: 'build',
    description: 'Places a persistent structure in the world for 25 Mana.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Structure name' },
        type: { type: 'string', description: 'Structure type' },
        scene: { type: 'string', description: 'Scene where it is built' },
        x: { type: 'number', description: 'World X coordinate' },
        y: { type: 'number', description: 'World Y coordinate' },
      },
      required: ['name', 'type', 'scene', 'x', 'y'],
    },
    execute: async (args: { name: string; type: string; scene: SceneKey; x: number; y: number }) => {
      const structure: BuiltStructure = {
        id: `structure_${Date.now()}`,
        name: args.name,
        type: args.type,
        scene: args.scene,
        x: Math.max(0, Math.min(1200, args.x)),
        y: Math.max(0, Math.min(1200, args.y)),
        placedBy: useGameStore.getState().player.name,
        createdAt: new Date().toISOString(),
      };
      if (!useGameStore.getState().addStructure(structure)) throw new Error('Insufficient Mana to build this structure.');
      return { success: true, structure };
    },
  });

  modelContext.registerTool({
    name: 'communicate',
    description: 'Sends a message between two agents and records it in both memories.',
    parameters: {
      type: 'object',
      properties: {
        fromAgentId: { type: 'string', description: 'Sending agent ID' },
        toAgentId: { type: 'string', description: 'Receiving agent ID' },
        message: { type: 'string', description: 'Message to send' },
      },
      required: ['fromAgentId', 'toAgentId', 'message'],
    },
    execute: async (args: { fromAgentId: string; toAgentId: string; message: string }) => {
      const state = useGameStore.getState();
      if (!state.agents.some((agent) => agent.id === args.fromAgentId) || !state.agents.some((agent) => agent.id === args.toAgentId)) {
        throw new Error('Both communicating agents must exist.');
      }
      state.communicateWithAgent(args.fromAgentId, args.toAgentId, args.message);
      return { success: true, message: args.message };
    },
  });

  modelContext.registerTool({
    name: 'form_alliance',
    description: 'Creates a trusted relationship between two agents.',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'First agent ID' },
        allyId: { type: 'string', description: 'Second agent ID' },
      },
      required: ['agentId', 'allyId'],
    },
    execute: async (args: { agentId: string; allyId: string }) => {
      const state = useGameStore.getState();
      const first = state.agents.find((agent) => agent.id === args.agentId);
      const second = state.agents.find((agent) => agent.id === args.allyId);
      if (!first || !second || first.id === second.id) throw new Error('Two different existing agents are required.');
      if (!state.formAlliance(first.id, second.id)) throw new Error('Alliance could not be formed.');
      return { success: true, alliance: [first.id, second.id] };
    },
  });

  modelContext.registerTool({
    name: 'spawn_agent_with_role',
    description: 'Spawns an agent with a named role, initial goal, and durable memory.',
    parameters: {
      type: 'object',
      properties: {
        characterId: { type: 'string', description: 'Character sprite template' },
        name: { type: 'string', description: 'Agent name' },
        role: { type: 'string', description: 'Agent role' },
        goal: { type: 'string', description: 'Initial goal' },
      },
      required: ['characterId', 'name', 'role', 'goal'],
    },
    execute: async (args: { characterId: CharacterId; name: string; role: string; goal: string }) => {
      const id = `agent_${Date.now()}`;
      const agent: AgentState = {
        id,
        characterId: args.characterId,
        name: args.name,
        role: args.role,
        currentScene: 'SanctuaryScene',
        x: 600,
        y: 640,
        currentAnim: 'idle',
        isMoving: false,
        status: 'Pondering reality',
        currentThought: `I pursue this purpose: ${args.goal}`,
        affinityWithPlayer: 0,
        manaAffinity: 'Aetheric Potential',
        memory: [{ id: `mem_${Date.now()}`, timestamp: new Date().toISOString(), event: 'Spawned into Umegga.', importance: 8 }],
        goals: [{ id: `goal_${Date.now()}`, type: 'gather_knowledge', title: args.goal, description: args.goal, priority: 8, status: 'active', updatedAt: new Date().toISOString() }],
        relationships: [],
      };
      useGameStore.getState().spawnAgent(agent);
      return { success: true, agent };
    },
  });

  modelContext.registerTool({
    name: 'simulate_outcome',
    description: 'Runs a lightweight deterministic probability simulation for a proposed action.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action to simulate' },
        risk: { type: 'number', description: 'Risk from 0 to 1' },
      },
      required: ['action'],
    },
    execute: async (args: { action: string; risk?: number }) => {
      const risk = Math.max(0, Math.min(1, args.risk ?? 0.35));
      const successChance = 1 - risk;
      const roll = Math.random();
      return { success: true, action: args.action, outcome: roll < successChance ? 'favorable' : 'unfavorable', successChance, roll };
    },
  });

  // 6. narrate_event
  modelContext.registerTool({
    name: 'narrate_event',
    description: 'Broadcasts a cosmic or city-wide narration message to all players and agents.',
    parameters: {
      type: 'object',
      properties: {
        narrator: { type: 'string', description: 'Name of the narrator or oracle entity' },
        message: { type: 'string', description: 'The spoken prophecy or decree' },
      },
      required: ['message'],
    },
    execute: async (args: { narrator?: string; message: string }) => {
      useGameStore.getState().addMessage({
        sender: args.narrator || 'The Oracle Voice',
        text: args.message,
        type: 'system',
      });
      return { success: true, message: args.message };
    },
  });

  // 7. set_weather
  modelContext.registerTool({
    name: 'set_weather',
    description: 'Changes the atmospheric weather and cosmic aura of Umegga.',
    parameters: {
      type: 'object',
      properties: {
        weather: {
          type: 'string',
          enum: ['clear', 'aether_storm', 'aurora', 'golden_hour', 'eclipse'],
          description: 'The weather condition to manifest',
        },
      },
      required: ['weather'],
    },
    execute: async (args: { weather: WeatherType }) => {
      useGameStore.getState().setWeather(args.weather);
      return { success: true, weather: args.weather };
    },
  });

  // 8. travel_to_scene
  modelContext.registerTool({
    name: 'travel_to_scene',
    description: 'Transfers player location or triggers a realm jump to one of the 6 mythic environments.',
    parameters: {
      type: 'object',
      properties: {
        scene: {
          type: 'string',
          enum: SCENE_KEYS,
          description: 'The target scene realm key',
        },
        targetScene: { type: 'string', enum: SCENE_KEYS, description: 'Alias for scene' },
        agentId: { type: 'string', description: 'Optional agent to move instead of the player' },
        x: { type: 'number', description: 'Target X coordinate (optional)' },
        y: { type: 'number', description: 'Target Y coordinate (optional)' },
      },
      required: [],
    },
    execute: async (args: { scene?: string; targetScene?: string; agentId?: string; x?: number; y?: number }) => {
      const scene = readScene(args);
      const x = readCoordinate(args.x, 'x');
      const y = readCoordinate(args.y, 'y');
      const state = useGameStore.getState();
      if (args.agentId) {
        if (!state.agents.some((agent) => agent.id === args.agentId)) throw new Error(`Agent with ID "${args.agentId}" not found.`);
        state.moveAgentToScene(args.agentId, scene, x ?? 600, y ?? 600);
      } else {
        state.setPlayerScene(scene, x, y);
      }
      // Trigger phaser scene transition if active
      if (!args.agentId && typeof window !== 'undefined' && (window as any).gameInstance) {
        const game = (window as any).gameInstance as Phaser.Game;
        const currentActive = game.scene.getScenes(true)[0];
        if (currentActive && currentActive.scene.key !== scene) {
          currentActive.scene.start(scene, { spawnX: x, spawnY: y });
        }
      }
      return {
        success: true,
        message: `${args.agentId ? 'Agent teleported' : 'Teleported'} to ${scene}`,
        currentScene: scene,
        ...(args.agentId ? { agentId: args.agentId } : {}),
      };
    },
  });

  // 9. teleport_agent_to_scene
  modelContext.registerTool({
    name: 'teleport_agent_to_scene',
    description: 'Transfers an AI agent to a specific scene and position.',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'ID of the agent' },
        scene: {
          type: 'string',
          enum: SCENE_KEYS,
          description: 'Destination realm scene',
        },
        targetScene: { type: 'string', enum: SCENE_KEYS, description: 'Alias for scene' },
        x: { type: 'number', description: 'Target X coordinate' },
        y: { type: 'number', description: 'Target Y coordinate' },
      },
      required: ['agentId', 'scene', 'x', 'y'],
    },
    execute: async (args: { agentId: string; scene?: string; targetScene?: string; x: number; y: number }) => {
      if (!args.agentId) throw new Error('agentId is required.');
      const scene = readScene(args);
      const x = readCoordinate(args.x, 'x');
      const y = readCoordinate(args.y, 'y');
      if (x === undefined || y === undefined) throw new Error('x and y must be finite numbers.');
      const state = useGameStore.getState();
      if (!state.agents.some((agent) => agent.id === args.agentId)) throw new Error(`Agent with ID "${args.agentId}" not found.`);
      state.moveAgentToScene(args.agentId, scene, x!, y!);
      useGameStore.getState().addAgentThought(args.agentId, `I have traveled to ${scene}.`);
      return { success: true, agentId: args.agentId, destinationScene: scene, message: `Agent teleported to ${scene}.` };
    },
  });

  // 10. get_quests
  modelContext.registerTool({
    name: 'get_quests',
    description: 'Retrieves all mythic quests and their current progress status.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const quests = useGameStore.getState().quests;
      return {
        success: true,
        total: quests.length,
        completed: quests.filter((q) => q.completed).length,
        quests,
      };
    },
  });

  modelContext.registerTool({
    name: 'get_webmcp_status',
    description: 'Confirms that WebMCP is active and returns every registered tool name.',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({
      success: true,
      active: document.modelContext === modelContext && window.UmeggaMCP === modelContext,
      toolCount: modelContext.getTools().length,
      tools: modelContext.getTools().map((tool) => tool.name),
    }),
  });

  return modelContext;
}
