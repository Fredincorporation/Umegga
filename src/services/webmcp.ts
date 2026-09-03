/**
 * WebMCP - Model Context Protocol Browser Integration
 * Exposes document.modelContext.registerTool for AI agents & LLM controllers.
 */

import { useGameStore } from '../store/useGameStore';
import { CharacterId, WeatherType, SceneKey } from '../types/game';

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
    umegaMCP?: WebMCPContext;
  }
}

export function initWebMCP() {
  const toolsMap = new Map<string, any>();

  const modelContext: WebMCPContext = {
    tools: toolsMap,
    registerTool: (tool) => {
      toolsMap.set(tool.name, tool);
      console.log(`[WebMCP] Registered tool: ${tool.name}`);
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

  // Attach to document and window per WebMCP specification
  if (typeof document !== 'undefined') {
    document.modelContext = modelContext;
  }
  if (typeof window !== 'undefined') {
    window.modelContext = modelContext;
    window.umegaMCP = modelContext;
  }

  // Register Standard Game Tools

  // 1. propose_story
  modelContext.registerTool({
    name: 'propose_story',
    description: 'Proposes a new mythic story that manifests in the city of Umega and shifts the reality distortion.',
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
        })),
      };
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
        currentThought: `I have stepped into Umega as ${args.role}.`,
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
      useGameStore.getState().updateAgentPosition(args.agentId, args.x, args.y, 'walk', true);
      useGameStore.getState().addAgentThought(args.agentId, `Travelling to coordinate (${args.x}, ${args.y}).`);
      return { success: true, agentId: args.agentId, target: { x: args.x, y: args.y } };
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
    description: 'Changes the atmospheric weather and cosmic aura of Umega.',
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
          enum: [
            'SanctuaryScene',
            'OracleBasinScene',
            'BotanistGroveScene',
            'GrandForgeScene',
            'BardsAmphitheatreScene',
            'FrayingMarchScene',
          ],
          description: 'The target scene realm key',
        },
        x: { type: 'number', description: 'Target X coordinate (optional)' },
        y: { type: 'number', description: 'Target Y coordinate (optional)' },
      },
      required: ['scene'],
    },
    execute: async (args: { scene: SceneKey; x?: number; y?: number }) => {
      useGameStore.getState().setPlayerScene(args.scene, args.x, args.y);
      // Trigger phaser scene transition if active
      if (typeof window !== 'undefined' && (window as any).gameInstance) {
        const game = (window as any).gameInstance as Phaser.Game;
        const currentActive = game.scene.getScenes(true)[0];
        if (currentActive && currentActive.scene.key !== args.scene) {
          currentActive.scene.start(args.scene, { spawnX: args.x, spawnY: args.y });
        }
      }
      return {
        success: true,
        message: `Teleported to ${args.scene}`,
        currentScene: args.scene,
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
          enum: [
            'SanctuaryScene',
            'OracleBasinScene',
            'BotanistGroveScene',
            'GrandForgeScene',
            'BardsAmphitheatreScene',
            'FrayingMarchScene',
          ],
          description: 'Destination realm scene',
        },
        x: { type: 'number', description: 'Target X coordinate' },
        y: { type: 'number', description: 'Target Y coordinate' },
      },
      required: ['agentId', 'scene', 'x', 'y'],
    },
    execute: async (args: { agentId: string; scene: SceneKey; x: number; y: number }) => {
      useGameStore.getState().moveAgentToScene(args.agentId, args.scene, args.x, args.y);
      useGameStore.getState().addAgentThought(args.agentId, `I have traveled to ${args.scene}.`);
      return { success: true, agentId: args.agentId, destinationScene: args.scene };
    },
  });

  return modelContext;
}
