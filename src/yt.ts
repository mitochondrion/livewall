// Thin wrapper around one YouTube IFrame-API player.
import { embedSrc } from './feeds';
import type { PlayerStatus, Source } from './types';

const NO_SIGNAL_AFTER_MS = 35_000; // never reached PLAYING → call it offline
const RETRY_OFFLINE_MS = 180_000; // offline feeds get retried periodically

/** The slice of the YouTube IFrame API we use. */
interface YTPlayer {
  mute(): void;
  unMute(): void;
  setVolume(v: number): void;
  playVideo(): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLIFrameElement,
    opts: {
      events: {
        onReady: () => void;
        onStateChange: (e: { data: number }) => void;
        onError: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace | null> | undefined;
export function loadYT(): Promise<YTNamespace | null> {
  apiPromise ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT ?? null);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => resolve(null);
    document.head.append(s);
  });
  return apiPromise;
}

const ERRORS: Record<number, string> = {
  2: 'Bad video ID',
  5: 'Player error',
  100: 'Video removed or private',
  101: 'Embedding disabled',
  150: 'Embedding disabled',
  153: 'Embed blocked (serve over http/https, not file://)',
};

export type StatusCallback = (status: PlayerStatus, detail?: string) => void;

export class Player {
  /** Current volume 0..100 (0 = muted). */
  level = 0;
  private iframe?: HTMLIFrameElement;
  private p?: YTPlayer;
  private ready = false;
  private muted = true;
  private watchdog?: ReturnType<typeof setTimeout>;
  private retry?: ReturnType<typeof setTimeout>;
  private fadeTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly host: HTMLElement,
    private feed: Source & { t?: string },
    private readonly onStatus: StatusCallback,
  ) {
    void this.mount();
  }

  private async mount(): Promise<void> {
    clearTimeout(this.watchdog);
    clearTimeout(this.retry);
    this.ready = false;
    this.muted = true;
    this.iframe?.remove();
    const iframe = document.createElement('iframe');
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.title = this.feed.t ?? 'Live stream';
    iframe.src = embedSrc(this.feed, location.origin);
    this.iframe = iframe;
    this.host.prepend(iframe);
    this.onStatus('loading');
    this.watchdog = setTimeout(() => this.fail('No signal'), NO_SIGNAL_AFTER_MS);

    const YT = await loadYT();
    if (this.iframe !== iframe) return; // reloaded or destroyed while waiting
    if (!YT) return this.fail('Couldn’t load the YouTube player');
    this.p = new YT.Player(iframe, {
      events: {
        onReady: () => {
          this.ready = true;
          this.p?.mute();
          this.p?.setVolume(0);
          this.p?.playVideo();
          if (this.level > 0) this.apply(this.level);
        },
        onStateChange: (e) => this.onState(e.data),
        onError: (e) => this.fail(ERRORS[e.data] ?? `Error ${e.data}`),
      },
    });
  }

  private onState(s: number): void {
    // 1 playing, 3 buffering, 2 paused, 0 ended, -1 unstarted, 5 cued
    if (s === 1) {
      clearTimeout(this.watchdog);
      clearTimeout(this.retry);
      this.onStatus('playing');
    } else if (s === 2 || s === 5 || s === 0) {
      // Live tiles should never sit paused; nudge them.
      try {
        this.p?.playVideo();
      } catch {
        /* player not ready */
      }
    }
  }

  private fail(detail: string): void {
    clearTimeout(this.watchdog);
    this.onStatus('offline', detail);
    clearTimeout(this.retry);
    this.retry = setTimeout(() => void this.mount(), RETRY_OFFLINE_MS);
  }

  reload(): void {
    void this.mount();
  }

  setFeed(feed: Source & { t?: string }): void {
    this.feed = feed;
    this.level = 0;
    void this.mount();
  }

  destroy(): void {
    clearTimeout(this.watchdog);
    clearTimeout(this.retry);
    clearInterval(this.fadeTimer);
    try {
      this.p?.destroy();
    } catch {
      /* already gone */
    }
    this.iframe?.remove();
    this.iframe = undefined;
  }

  /** Apply a volume level immediately (0 mutes). */
  private apply(level: number): void {
    if (!this.ready || !this.p) return;
    try {
      if (level <= 0) {
        if (!this.muted) this.p.mute();
        this.muted = true;
      } else {
        if (this.muted) this.p.unMute();
        this.muted = false;
        this.p.setVolume(Math.round(level));
      }
    } catch {
      /* player not ready */
    }
  }

  /** Short linear fade so hover-switching doesn't pop. */
  fadeTo(target: number, ms = 250): void {
    clearInterval(this.fadeTimer);
    const from = this.level;
    if (from === target || ms <= 0) {
      this.level = target;
      return this.apply(target);
    }
    const t0 = performance.now();
    this.fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      this.level = from + (target - from) * k;
      this.apply(this.level);
      if (k >= 1) {
        clearInterval(this.fadeTimer);
        this.level = target;
        this.apply(target);
      }
    }, 40);
  }
}
