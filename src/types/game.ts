/**
 * Umegga - Mythic City-State Types and Interfaces
 */

export type SceneKey =
  | 'SanctuaryScene'
  | 'OracleBasinScene'
  | 'BotanistGroveScene'
  | 'GrandForgeScene'
  | 'BardsAmphitheatreScene'
  | 'FrayingMarchScene'
  | 'OuterWastesScene';

export type CharacterId =
  | 'aelira'
  | 'torren'
  | 'kaelen'
  | 'veyra'
  | 'orthas'
  | 'sylis'
  | 'lira'
  | 'elder_maelon'
  | 'vance';

export type AnimationType = 'idle' | 'walk' | 'talk';

export type WeatherType = 'clear' | 'aether_storm' | 'aurora' | 'golden_hour' | 'eclipse';

export interface CharacterMeta {
  id: CharacterId;
  name: string;
  title: string;
  role: 'Mage' | 'Arbiter' | 'Artisan' | 'Oracle' | 'Architect' | 'Botanist' | 'Bard' | 'Scholar' | 'Merchant';
  lore: string;
  defaultPosition: { x: number; y: number };
  accentColor: string;
  badgeBg: string;
  baseSpeed: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  objective: string;
  targetType: 'talk' | 'story' | 'law' | 'travel' | 'mcp' | 'build' | 'alliance' | 'intervention' | 'personality_growth';
  targetId?: string;
  targetCount?: number;
  currentCount?: number;
  completed: boolean;
  rewardMana: number;
  rewardRenown: number;
  category?: 'core' | 'personality_growth';
  expiresAt?: string;
  targetAgentId?: string;
  rewardRelationship?: number;
}

export interface AgentPersonality {
  traits: {
    idealism: number;
    order: number;
    openness: number;
    caution: number;
    pride: number;
    empathy: number;
    curiosity: number;
    ambition: number;
  };
  speakingStyle: string;
  values: string[];
  quirks: string[];
  playerAttitude: string;
  eventReactions: { stories: string; laws: string; alliances: string; conflict: string };
  emotionalTendency: string;
  trustThreshold: number;
  helpWillingness: number;
  growthFocus?: string;
}

export interface AgentMemory {
  id: string;
  timestamp: string;
  event: string;
  importance: number; // 1-10
  type?: 'observation' | 'conversation' | 'story' | 'law' | 'goal' | 'action';
  subjectAgentId?: string;
  scene?: SceneKey;
}

export interface AgentGoal {
  id: string;
  type: 'build' | 'communicate' | 'enforce_law' | 'gather_knowledge' | 'protect_area' | 'travel' | 'support_ally' | 'personality_growth';
  title: string;
  description: string;
  priority: number;
  status: 'active' | 'completed' | 'blocked';
  targetAgentId?: string;
  targetScene?: SceneKey;
  updatedAt: string;
}

export interface AgentRelationship {
  agentId: string;
  affinity: number; // -100 to 100
  trust: number; // 0 to 100
  allied?: boolean;
  history: string[];
}

export interface InterventionRequest {
  id: string;
  agentId: string;
  reason: string;
  action: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'ignored';
}

export interface AgentState {
  id: string;
  characterId: CharacterId;
  name: string;
  role: string;
  currentScene?: SceneKey;
  x: number;
  y: number;
  currentAnim: AnimationType;
  isMoving: boolean;
  status: 'Pondering reality' | 'Patrolling the district' | 'Weaving runes' | 'Transmuting ores' | 'Consulting the stars' | 'Drafting decrees' | 'Resting';
  currentThought?: string;
  memory: AgentMemory[];
  goals?: AgentGoal[];
  relationships?: AgentRelationship[];
  affinityWithPlayer: number; // -100 to 100
  manaAffinity: string;
  personality?: AgentPersonality;
}

export interface PlayerState {
  id: string;
  name: string;
  characterId: CharacterId;
  currentScene: SceneKey;
  x: number;
  y: number;
  currentAnim: AnimationType;
  isMoving: boolean;
  mana: number;
  renown: number;
}

export interface StoryEntry {
  id: string;
  title: string;
  content: string;
  summary?: string;
  fullContent?: string;
  author: string;
  timestamp: string;
  impactSummary: string;
  visualEffectType: 'aurora' | 'crystal_growth' | 'flame_ward' | 'verdant_bloom' | 'celestial_eclipse';
  resonance: number;
  enacted: boolean;
}

export interface LawEffect {
  type: 'speed_boost' | 'mana_regeneration' | 'agent_curiosity' | 'radiant_glow' | 'gravitational_lightness';
  magnitude: number;
  description: string;
}

export interface LawEntry {
  id: string;
  title: string;
  edict: string;
  author: string;
  category: 'Reality Edict' | 'Arcane Decree' | 'Civic Order' | 'Cosmic Harmonization';
  passedAt: string;
  active: boolean;
  effect: LawEffect;
}

export interface BuiltStructure {
  id: string;
  name: string;
  type: string;
  scene: SceneKey;
  x: number;
  y: number;
  placedBy: string;
  createdAt: string;
}

export interface WorldState {
  cityName: string;
  manaLevel: number; // 0 - 1000
  manaByScene: Record<SceneKey, number>;
  weather: WeatherType;
  worldAuraColor: string;
  activeLaws: LawEntry[];
  chronicles: StoryEntry[];
  structures?: BuiltStructure[];
  timeOfDay: number; // 0 to 2400
  realityDistortion: number; // 0 to 1
}

export interface ChatMessage {
  id: string;
  sender: string;
  senderId?: string;
  recipientAgentId?: string;
  role?: string;
  avatarId?: CharacterId;
  text: string;
  timestamp: string;
  type: 'chat' | 'system' | 'story' | 'law' | 'agent' | 'mcp';
  channel?: 'conversation';
  /** Browser session that produced this message; chat is only visible within it. */
  sessionId?: string;
}

export interface RemotePlayer {
  id: string;
  name: string;
  characterId: CharacterId;
  x: number;
  y: number;
  currentAnim: AnimationType;
  lastSeen: number;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  handler: (args: Record<string, any>) => Promise<any> | any;
}
