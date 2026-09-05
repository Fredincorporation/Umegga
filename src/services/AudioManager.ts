import { loadAudioState, saveAudioState } from './supabase';
import { assetUrl } from '../config/assets';

const TRACK_URLS = ['/music/1.ogg', '/music/2.ogg'].map(assetUrl);
const DEFAULT_VOLUME = 0.45;

class AudioManager {
  private readonly tracks = new Map<number, HTMLAudioElement>();
  private currentIndex = 0;
  private currentTrack?: HTMLAudioElement;
  private volume = DEFAULT_VOLUME;
  private started = false;
  private startPosition = 0;
  private unlockHandler?: () => void;

  start() {
    if (this.started || typeof window === 'undefined') return;

    // Music resume point is persisted in Supabase (Umegga_audio_state), not in
    // the browser. Playback starts immediately with defaults and seeks once
    // the remote row arrives.
    this.currentTrack = this.getTrack(this.currentIndex);
    this.currentTrack.volume = this.volume;
    this.currentTrack.autoplay = false;
    this.currentTrack.addEventListener('loadedmetadata', this.handleCurrentMetadata);

    void loadAudioState()
      .then((state) => {
        if (!state) return;
        if (Number.isInteger(state.track_index) && state.track_index >= 0 && state.track_index < TRACK_URLS.length && state.track_index !== this.currentIndex) {
          this.currentIndex = state.track_index;
          const next = this.getTrack(this.currentIndex);
          next.volume = this.volume;
          next.autoplay = false;
          next.addEventListener('loadedmetadata', this.handleCurrentMetadata);
          next.muted = this.currentTrack?.muted ?? false;
          this.currentTrack?.pause();
          this.currentTrack = next;
          next.load();
        }
        if (Number.isFinite(state.position_seconds) && state.position_seconds > 0) {
          this.startPosition = state.position_seconds;
        }
        void this.playCurrentTrack();
      })
      .catch((error) => console.error('[Supabase] audio state load failed:', error));

    this.unlockHandler = () => {
      if (this.currentTrack?.muted) {
        this.currentTrack.muted = false;
      }
      void this.playCurrentTrack();
    };
    document.addEventListener('pointerdown', this.unlockHandler);
    document.addEventListener('keydown', this.unlockHandler);

    this.currentTrack.load();
    void this.playCurrentTrack();

    window.addEventListener('pagehide', this.saveState);
    window.addEventListener('beforeunload', this.saveState);
    this.started = true;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.tracks.forEach((track) => {
      if (track === this.currentTrack) track.volume = this.volume;
    });
  }

  private getTrack(index: number) {
    const existingTrack = this.tracks.get(index);
    if (existingTrack) return existingTrack;

    const track = new Audio(TRACK_URLS[index]);
    // Metadata only: avoids eagerly buffering the full 2.6MB OGG before it is
    // actually needed. The browser streams the audio once playback starts.
    track.preload = 'metadata';
    track.autoplay = false;
    track.volume = this.volume;
    track.addEventListener('ended', this.handleTrackEnded);
    this.tracks.set(index, track);
    return track;
  }

  private async playCurrentTrack() {
    if (!this.currentTrack) return;

    // Ensure all other tracks are paused so only one track plays at a time
    this.tracks.forEach((track, idx) => {
      if (idx !== this.currentIndex) {
        track.pause();
        track.currentTime = 0;
      }
    });

    if (this.currentTrack.readyState >= HTMLMediaElement.HAVE_METADATA && this.startPosition > 0) {
      this.currentTrack.currentTime = Math.min(this.startPosition, Math.max(0, this.currentTrack.duration - 0.25));
      this.startPosition = 0;
    }

    try {
      await this.currentTrack.play();
      if (this.unlockHandler && !this.currentTrack.muted) {
        document.removeEventListener('pointerdown', this.unlockHandler);
        document.removeEventListener('keydown', this.unlockHandler);
      }
      this.preloadNextTrack();
    } catch {
      // Start silently when audible autoplay is blocked, then unmute on interaction.
      this.currentTrack.muted = true;
      void this.currentTrack.play().then(() => this.preloadNextTrack()).catch(() => undefined);
    }
  }

  private preloadNextTrack() {
    const nextIndex = (this.currentIndex + 1) % TRACK_URLS.length;
    const nextTrack = this.getTrack(nextIndex);
    nextTrack.autoplay = false;
    if (nextTrack.readyState === HTMLMediaElement.HAVE_NOTHING) {
      nextTrack.load();
    }
  }

  private readonly handleCurrentMetadata = () => {
    void this.playCurrentTrack();
  };

  private readonly handleTrackEnded = () => {
    const oldTrack = this.currentTrack;
    if (oldTrack) {
      oldTrack.pause();
      oldTrack.currentTime = 0;
    }

    const nextIndex = (this.currentIndex + 1) % TRACK_URLS.length;
    const nextTrack = this.getTrack(nextIndex);

    this.currentIndex = nextIndex;
    this.currentTrack = nextTrack;
    this.startPosition = 0;
    nextTrack.currentTime = 0;
    nextTrack.volume = this.volume;
    if (oldTrack) {
      nextTrack.muted = oldTrack.muted;
    }

    void this.playCurrentTrack().then(() => {
      this.saveState();
    });
  };

  private saveState = () => {
    if (!this.currentTrack) return;
    void saveAudioState({
      track_index: this.currentIndex,
      position_seconds: this.currentTrack.currentTime,
    }).catch((error) => console.error('[Supabase] audio state save failed:', error));
  };
}

export const audioManager = new AudioManager();
