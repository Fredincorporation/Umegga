import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AgentState, ChatMessage, StoryEntry, LawEntry } from '../types/game';
import { getChatSessionId } from './chatSession';

// Check for environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function logSupabaseError(operation: string, error: unknown) {
  console.error(`[Supabase] ${operation} failed:`, error);
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function loadPersistedAgents(): Promise<AgentState[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('umega_agents').select('state');
  if (error) {
    logSupabaseError('load agents', error);
    return [];
  }
  if (!data) return [];
  // Dedupe by agent id: the table PK prevents duplicate rows, but the stored
  // snapshot itself could contain repeated entries from older saves.
  const seen = new Set<string>();
  return (data as Array<{ state: AgentState }>)
    .map((row) => row.state)
    .filter((agent): agent is AgentState => {
      if (!agent?.id || seen.has(agent.id)) return false;
      seen.add(agent.id);
      return true;
    });
}

export async function loadChatMessages(limit = 80): Promise<ChatMessage[]> {
  if (!supabase) return [];
  const sessionId = getChatSessionId();
  const { data, error } = await supabase
    .from('umega_chat_messages')
    .select('message')
    .or(`message->>sessionId.eq.${sessionId},message->>sessionId.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logSupabaseError('load chat messages', error);
    return [];
  }
  if (!data) return [];
  const seen = new Set<string>();
  const messages: ChatMessage[] = [];
  (data as Array<{ message: ChatMessage }>).forEach((row) => {
    if (!row.message?.id || seen.has(row.message.id)) return;
    seen.add(row.message.id);
    messages.push(row.message);
  });
  // Oldest first, matching the in-memory order.
  return messages.reverse();
}

export async function loadWorldEvents(limit = 200): Promise<Array<{ id: string; event_type: string; payload: any }>> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('umega_world_events')
    .select('id, event_type, payload')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logSupabaseError('load world events', error);
    return [];
  }
  if (!data) return [];
  const seen = new Set<string>();
  return (data as Array<{ id: string; event_type: string; payload: any }>).filter((row) => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export async function loadMCPLogs(limit = 30): Promise<Array<{ id: string; tool: string; args: any; result: any; timestamp: string }>> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('umega_world_events')
    .select('payload')
    .eq('event_type', 'mcp_call')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Array<{ payload: any }>)
    .map((row) => row.payload)
    .filter((log) => log?.id && log?.tool)
    .reverse();
}

export interface AudioStateRow {
  track_index: number;
  position_seconds: number;
}

export async function loadChronicles(limit = 200): Promise<StoryEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('umega_chronicles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const seen = new Set<string>();
  return (data as Array<Record<string, any>>).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    summary: row.summary || row.content.slice(0, 140),
    fullContent: row.full_content || row.content,
    author: row.author,
    timestamp: row.chronicle_time || '',
    impactSummary: row.impact_summary || '',
    visualEffectType: row.visual_effect_type || 'aurora',
    resonance: row.resonance ?? 75,
    enacted: row.enacted ?? true,
  }) as StoryEntry).filter((story) => {
    if (!story.id || seen.has(story.id)) return false;
    seen.add(story.id);
    return true;
  });
}

export async function saveChronicle(story: StoryEntry): Promise<void> {
  if (!supabase || !story?.id) return;
  const { error } = await supabase.from('umega_chronicles').upsert(
    {
      id: story.id,
      title: story.title,
      author: story.author,
      summary: story.summary ?? null,
      content: story.content,
      full_content: story.fullContent ?? story.content,
      chronicle_time: story.timestamp ?? null,
      impact_summary: story.impactSummary ?? null,
      visual_effect_type: story.visualEffectType ?? null,
      resonance: story.resonance ?? 75,
      enacted: story.enacted ?? true,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function loadLaws(limit = 200): Promise<LawEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('umega_laws')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  const seen = new Set<string>();
  return (data as Array<Record<string, any>>).map((row) => ({
    id: row.id,
    title: row.title,
    edict: row.edict,
    author: row.author,
    category: row.category || 'Reality Edict',
    passedAt: row.passed_at || '',
    active: row.active ?? true,
    effect: row.effect && typeof row.effect === 'object' ? row.effect : { type: 'speed_boost', magnitude: 1, description: '' },
  }) as LawEntry).filter((law) => {
    if (!law.id || seen.has(law.id)) return false;
    seen.add(law.id);
    return true;
  });
}

export async function saveLaw(law: LawEntry): Promise<void> {
  if (!supabase || !law?.id) return;
  const { error } = await supabase.from('umega_laws').upsert(
    {
      id: law.id,
      title: law.title,
      author: law.author,
      edict: law.edict,
      category: law.category ?? null,
      passed_at: law.passedAt ?? null,
      effect: law.effect ?? {},
      active: law.active ?? true,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function loadAudioState(): Promise<AudioStateRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('umega_audio_state')
    .select('track_index, position_seconds')
    .eq('id', 'global')
    .maybeSingle();
  if (error || !data) return null;
  return data as AudioStateRow;
}

export async function saveAudioState(state: AudioStateRow): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('umega_audio_state').upsert(
    { id: 'global', ...state, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function savePersistedAgents(agents: AgentState[]): Promise<void> {
  if (!supabase || agents.length === 0) return;
  const { error } = await supabase.from('umega_agents').upsert(
    agents.map((agent) => ({ id: agent.id, state: agent, updated_at: new Date().toISOString() })),
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function loadPersistedGameState(): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('umega_game_state').select('state').eq('id', 'global').maybeSingle();
  if (error || !data?.state || typeof data.state !== 'object') return null;
  return data.state as Record<string, unknown>;
}

export async function savePersistedGameState(state: Record<string, unknown>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('umega_game_state').upsert(
    { id: 'global', state, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function saveChatMessage(message: ChatMessage): Promise<void> {
  if (!supabase || !message?.id) return;
  const { error } = await supabase.from('umega_chat_messages').upsert(
    { id: message.id, message, created_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function saveWorldEvent(eventType: string, payload: unknown, id = `${eventType}_${Date.now()}`): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('umega_world_events').upsert(
    { id, event_type: eventType, payload, created_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

/**
 * Realtime Event Bridge
 * Uses Supabase Realtime Channels if configured, or Web BroadcastChannel for local/multi-tab sync.
 */
class RealtimeBridge {
  private broadcastChannel: BroadcastChannel | null = null;
  private supabaseChannel: any = null;
  private messageListeners: Array<(msg: ChatMessage) => void> = [];
  private storyListeners: Array<(story: StoryEntry) => void> = [];
  private lawListeners: Array<(law: LawEntry) => void> = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('Umegga_network');
      this.broadcastChannel.onmessage = (event) => {
        this.handleNetworkPayload(event.data);
      };
    }

    if (supabase) {
      this.setupSupabaseRealtime();
    }
  }

  private setupSupabaseRealtime() {
    if (!supabase) return;

    this.supabaseChannel = supabase.channel('Umegga_nexus_room', {
      config: { presence: { key: 'nexus_presence' } },
    });

    this.supabaseChannel
      .on('broadcast', { event: 'game_event' }, (payload: any) => {
        this.handleNetworkPayload(payload.payload);
      })
      .subscribe((status: string) => {
        console.log('[Supabase Realtime Status]:', status);
      });
  }

  private handleNetworkPayload(payload: any) {
    if (!payload || !payload.type) return;

    switch (payload.type) {
      case 'CHAT_MESSAGE': {
        // Chat is session-private: ignore messages from other browsers.
        const data = payload.data as ChatMessage | undefined;
        if (data?.sessionId && data.sessionId !== getChatSessionId()) break;
        this.messageListeners.forEach((fn) => fn(payload.data));
        break;
      }
      case 'STORY_PROPOSED':
        this.storyListeners.forEach((fn) => fn(payload.data));
        break;
      case 'LAW_ENACTED':
        this.lawListeners.forEach((fn) => fn(payload.data));
        break;
      case 'PLAYER_MOVE':
        // Handled via presence
        break;
    }
  }

  public broadcastMessage(msg: ChatMessage) {
    this.broadcastChannel?.postMessage({ type: 'CHAT_MESSAGE', data: msg });
    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'game_event',
      payload: { type: 'CHAT_MESSAGE', data: msg },
    });
  }

  public broadcastStory(story: StoryEntry) {
    this.broadcastChannel?.postMessage({ type: 'STORY_PROPOSED', data: story });
    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'game_event',
      payload: { type: 'STORY_PROPOSED', data: story },
    });
  }

  public broadcastLaw(law: LawEntry) {
    this.broadcastChannel?.postMessage({ type: 'LAW_ENACTED', data: law });
    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'game_event',
      payload: { type: 'LAW_ENACTED', data: law },
    });
  }

  public onMessage(fn: (msg: ChatMessage) => void) {
    this.messageListeners.push(fn);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== fn);
    };
  }

  public onStory(fn: (story: StoryEntry) => void) {
    this.storyListeners.push(fn);
    return () => {
      this.storyListeners = this.storyListeners.filter((l) => l !== fn);
    };
  }

  public onLaw(fn: (law: LawEntry) => void) {
    this.lawListeners.push(fn);
    return () => {
      this.lawListeners = this.lawListeners.filter((l) => l !== fn);
    };
  }
}

export const realtimeBridge = new RealtimeBridge();
