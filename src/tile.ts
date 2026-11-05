import { $ } from './dom';
import { feedKey, feedUrl } from './feeds';
import { Player } from './yt';
import type { Feed, PlayerStatus } from './types';

const TILE_HTML = `
  <div class="crt-body">
    <div class="screen"><div class="static"></div><div class="status"><b>NO SIGNAL</b><small></small></div><div class="glass"></div></div>
    <div class="deco"><i class="grille"></i><i class="knob k1"></i><i class="knob k2"></i><i class="led"></i></div>
  </div>
  <div class="hit"></div>
  <div class="hud"><span class="cam"></span><span class="rec">● REC</span><span class="ts"></span></div>
  <div class="label"><span class="eq"><i></i><i></i><i></i></span><span class="name"></span></div>
  <div class="tools">
    <a class="t-open" target="_blank" rel="noopener" title="Open on YouTube">↗</a>
    <button class="t-reload" title="Reload this feed">⟳</button>
  </div>`;

export interface TileHandlers {
  hover(id: string): void;
  leave(id: string): void;
  click(id: string): void;
}

/**
 * One feed on the wall. Its DOM node is created once and never reparented
 * (that would reload the iframe); modes only restyle it.
 */
export class Tile {
  readonly el: HTMLDivElement;
  readonly player: Player;
  private active = false;
  private readonly status: HTMLElement;

  constructor(
    public feed: Feed,
    container: HTMLElement,
    handlers: TileHandlers,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'tile';
    this.el.dataset.status = 'loading';
    this.el.innerHTML = TILE_HTML;
    this.status = $('.status small', this.el);
    container.append(this.el);

    this.player = new Player($('.screen', this.el), feed, (s, d) => this.setStatus(s, d));

    this.el.addEventListener(
      'pointerenter',
      (e) => e.pointerType === 'mouse' && handlers.hover(this.feed.id),
    );
    this.el.addEventListener(
      'pointerleave',
      (e) => e.pointerType === 'mouse' && handlers.leave(this.feed.id),
    );
    this.el.addEventListener('click', (e) => {
      if (!(e.target as Element).closest('.tools')) handlers.click(this.feed.id);
    });
    $('.t-reload', this.el).addEventListener('click', () => this.player.reload());
    this.paint();
  }

  paint(): void {
    $('.name', this.el).textContent = this.feed.t;
    $<HTMLAnchorElement>('.t-open', this.el).href = feedUrl(this.feed);
  }

  /** Re-point at a (possibly different) feed, reloading only if the stream changed. */
  update(feed: Feed): void {
    const changed = feedKey(feed) !== feedKey(this.feed);
    this.feed = feed;
    this.paint();
    if (changed) this.player.setFeed(feed);
  }

  setCam(index: number): void {
    $('.cam', this.el).textContent = `CAM ${String(index + 1).padStart(2, '0')}`;
  }

  setTimestamp(text: string): void {
    $('.ts', this.el).textContent = text;
  }

  setStatus(s: PlayerStatus, detail?: string): void {
    this.el.dataset.status = s;
    this.status.textContent = s === 'offline' && detail !== 'No signal' ? (detail ?? '') : '';
  }

  setActive(on: boolean): void {
    if (on === this.active) return;
    this.active = on;
    this.el.classList.toggle('audio', on);
    if (on) {
      this.el.classList.remove('blip');
      void this.el.offsetWidth; // restart the CSS animation
      this.el.classList.add('blip');
    }
  }

  destroy(): void {
    this.player.destroy();
    this.el.remove();
  }
}
