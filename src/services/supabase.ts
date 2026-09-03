import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ChatMessage, StoryEntry, LawEntry } from '../types/game';

// Check for environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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
      this.broadcastChannel = new BroadcastChannel('umega_network');
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

    this.supabaseChannel = supabase.channel('umega_nexus_room', {
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
      case 'CHAT_MESSAGE':
        this.messageListeners.forEach((fn) => fn(payload.data));
        break;
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
