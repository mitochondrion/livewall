// Thin wrapper around one YouTube IFrame-API player.
import { embedSrc } from './feeds.js';

const NO_SIGNAL_AFTER_MS = 35_000; // never reached PLAYING → call it offline
const RETRY_OFFLINE_MS = 180_000; // offline channels get retried periodically

let apiPromise;
export function loadYT() {
  apiPromise ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => resolve(null);
    document.head.append(s);
  });
  return apiPromise;
}

export class Player {
  /**
   * @param {HTMLElement} host   element the iframe is prepended into
   * @param {object} feed        {ch}|{v}
   * @param {(status:'loading'|'playing'|'offline', detail?:string)=>void} onStatus
   */
  constructor(host, feed, onStatus) {
    this.host = host;
    this.feed = feed;
    this.onStatus = onStatus;
    this.level = 0; // 0 = muted, else 1..100
    this.fadeTimer = null;
    this.ready = false;
    this.mount();
  }

  async mount() {
    clearTimeout(this.watchdog);
    clearTimeout(this.retry);
    this.ready = false;
    this.muted = true;
    this.iframe?.remove();
    const iframe = document.createElement('iframe');
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('loading', 'eager');
    iframe.title = this.feed.t || 'Live stream';
    iframe.src = embedSrc(this.feed, location.origin);
    this.iframe = iframe;
    this.host.prepend(iframe);
    this.onStatus('loading');
    this.watchdog = setTimeout(() => this.fail('No signal'), NO_SIGNAL_AFTER_MS);

    const YT = await loadYT();
    if (this.iframe !== iframe) return; // reloaded while waiting
    if (!YT) return this.fail('Couldn’t load the YouTube player');
    this.p = new YT.Player(iframe, {
      events: {
        onReady: () => {
          this.ready = true;
          this.p.mute();
          this.p.setVolume(0);
          this.p.playVideo();
          if (this.level > 0) this.apply(this.level);
        },
        onStateChange: (e) => this.onState(e.data),
        onError: (e) => this.fail(ERRORS[e.data] || `Error ${e.data}`),
      },
    });
  }

  onState(s) {
    // 1 playing, 3 buffering, 2 paused, 0 ended, -1 unstarted, 5 cued
    if (s === 1) {
      clearTimeout(this.watchdog);
      clearTimeout(this.retry);
      this.onStatus('playing');
    } else if (s === 2 || s === 5 || s === 0) {
      // Live tiles should never sit paused; nudge them.
      try {
        this.p.playVideo();
      } catch {}
    }
  }

  fail(detail) {
    clearTimeout(this.watchdog);
    this.onStatus('offline', detail);
    clearTimeout(this.retry);
    this.retry = setTimeout(() => this.mount(), RETRY_OFFLINE_MS);
  }

  reload() {
    this.mount();
  }

  setFeed(feed) {
    this.feed = feed;
    this.level = 0;
    this.mount();
  }

  destroy() {
    clearTimeout(this.watchdog);
    clearTimeout(this.retry);
    clearInterval(this.fadeTimer);
    try {
      this.p?.destroy();
    } catch {}
    this.iframe?.remove();
  }

  /** Apply a volume level immediately (0 mutes). */
  apply(level) {
    if (!this.ready) return;
    try {
      if (level <= 0) {
        if (!this.muted) this.p.mute();
        this.muted = true;
      } else {
        if (this.muted) this.p.unMute();
        this.muted = false;
        this.p.setVolume(Math.round(level));
      }
    } catch {}
  }

  /** Short linear fade so hover-switching doesn't pop. */
  fadeTo(target, ms = 250) {
    clearInterval(this.fadeTimer);
    const from = this.level;
    this.target = target;
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

const ERRORS = {
  2: 'Bad video ID',
  5: 'Player error',
  100: 'Video removed or private',
  101: 'Embedding disabled',
  150: 'Embedding disabled',
  153: 'Embed blocked (serve over http/https, not file://)',
};
