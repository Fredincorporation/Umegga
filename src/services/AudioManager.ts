const TRACK_URLS = ['/music/1.ogg', '/music/2.ogg'];
const TRACK_STATE_KEY = 'umega-music-track';
const POSITION_STATE_KEY = 'umega-music-position';
const DEFAULT_VOLUME = 0.45;
const FADE_DURATION_MS = 900;

class AudioManager {
  private readonly tracks = new Map<number, HTMLAudioElement>();
  private currentIndex = 0;
  private currentTrack?: HTMLAudioElement;
  private volume = DEFAULT_VOLUME;
  private started = false;
  private startPosition = 0;
  private fadeInterval?: number;
  private unlockHandler?: () => void;

  start() {
    if (this.started || typeof window === 'undefined') return;

    this.currentIndex = this.readTrackIndex();
    this.startPosition = this.readPosition();
    this.currentTrack = this.getTrack(this.currentIndex);
    this.currentTrack.volume = this.volume;
    this.currentTrack.autoplay = true;
    this.currentTrack.addEventListener('loadedmetadata', this.handleCurrentMetadata);

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
    track.preload = 'auto';
    track.autoplay = true;
    track.volume = this.volume;
    track.addEventListener('ended', this.handleTrackEnded);
    this.tracks.set(index, track);
    return track;
  }

  private async playCurrentTrack() {
    if (!this.currentTrack) return;
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
    if (nextTrack.readyState === HTMLMediaElement.HAVE_NOTHING) nextTrack.load();
  }

  private readonly handleCurrentMetadata = () => {
    void this.playCurrentTrack();
  };

  private readonly handleTrackEnded = () => {
    const oldTrack = this.currentTrack;
    if (!oldTrack) return;
    const nextIndex = (this.currentIndex + 1) % TRACK_URLS.length;
    const nextTrack = this.getTrack(nextIndex);
    const beginTransition = () => {
      nextTrack.removeEventListener('canplay', beginTransition);
      this.currentIndex = nextIndex;
      this.currentTrack = nextTrack;
      this.startPosition = 0;
      nextTrack.currentTime = 0;
      nextTrack.volume = 0;
      nextTrack.muted = oldTrack.muted;
      void nextTrack.play().then(() => {
        this.crossfade(oldTrack, nextTrack);
        this.saveState();
        this.preloadNextTrack();
      }).catch(() => {
        nextTrack.volume = this.volume;
      });
    };

    if (nextTrack.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      beginTransition();
    } else {
      nextTrack.addEventListener('canplay', beginTransition, { once: true });
      nextTrack.load();
    }
  };

  private crossfade(oldTrack: HTMLAudioElement, nextTrack: HTMLAudioElement) {
    if (this.fadeInterval) window.clearInterval(this.fadeInterval);
    const startedAt = performance.now();
    this.fadeInterval = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / FADE_DURATION_MS);
      oldTrack.volume = this.volume * (1 - progress);
      nextTrack.volume = this.volume * progress;
      if (progress >= 1) {
        if (this.fadeInterval) window.clearInterval(this.fadeInterval);
        this.fadeInterval = undefined;
        oldTrack.pause();
        oldTrack.currentTime = 0;
      }
    }, 40);
  }

  private saveState = () => {
    if (!this.currentTrack) return;
    localStorage.setItem(TRACK_STATE_KEY, String(this.currentIndex));
    localStorage.setItem(POSITION_STATE_KEY, String(this.currentTrack.currentTime));
  };

  private readTrackIndex() {
    const value = Number.parseInt(localStorage.getItem(TRACK_STATE_KEY) ?? '0', 10);
    return Number.isInteger(value) && value >= 0 && value < TRACK_URLS.length ? value : 0;
  }

  private readPosition() {
    const value = Number.parseFloat(localStorage.getItem(POSITION_STATE_KEY) ?? '0');
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }
}

export const audioManager = new AudioManager();
