import type { Store } from '../app/store';
import type { ExhibitId } from '../content/types';
import { getContent } from '../content/exhibits.ja';
import { ZONES, type ZoneId } from '../world/layout';
import { h, show } from './dom';

export interface HudActions {
  viewNearby(): void;
}

export class Hud {
  readonly el: HTMLElement;
  private readonly zone: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly prompt: HTMLButtonElement;
  private readonly promptTitle: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly toastText: HTMLElement;
  private readonly toastSwatch: HTMLElement;
  private toastTimer = 0;

  constructor(store: Store, actions: HudActions) {
    this.crosshair = h('div', { class: 'hud__crosshair', attrs: { 'aria-hidden': 'true' } });
    this.zone = h('p', { class: 'hud__zone', attrs: { 'aria-live': 'polite' } });
    this.promptTitle = h('span', { class: 'hud__prompt-title' });
    this.prompt = h(
      'button',
      {
        class: 'hud__prompt',
        attrs: { type: 'button', 'data-testid': 'view-prompt' },
        on: { click: () => actions.viewNearby() },
      },
      [
        h('kbd', { class: 'hud__key', text: 'E' }),
        h('span', { class: 'hud__prompt-verb', text: '鑑賞する' }),
        this.promptTitle,
      ],
    );
    this.toastSwatch = h('span', { class: 'hud__swatch', attrs: { 'aria-hidden': 'true' } });
    this.toastText = h('span');
    this.toastEl = h(
      'p',
      { class: 'hud__toast', attrs: { role: 'status', 'data-testid': 'toast' } },
      [this.toastSwatch, this.toastText],
    );
    this.toastEl.hidden = true;
    this.el = h('div', { class: 'hud' }, [this.crosshair, this.zone, this.prompt, this.toastEl]);

    const render = () => {
      const s = store.get();
      show(this.el, s.mode === 'walking' || s.mode === 'viewing');
      show(this.crosshair, s.mode === 'walking');
      const info = s.zoneId ? ZONES[s.zoneId as ZoneId] : undefined;
      this.zone.textContent = info ? info.name : '';
      show(this.zone, !!info && s.mode === 'walking');
      const near = s.mode === 'walking' ? (s.nearbyExhibitId as ExhibitId | null) : null;
      show(this.prompt, !!near);
      if (near) {
        const c = getContent(near);
        this.promptTitle.textContent = `${c.number}  ${c.title}`;
      }
    };
    store.subscribe(render);
    render();
  }

  /** 画面下部に数秒だけお知らせを出す */
  toast(message: string, swatch?: string, seconds = 6): void {
    this.toastText.textContent = message;
    this.toastSwatch.hidden = !swatch;
    if (swatch) this.toastSwatch.style.background = swatch;
    this.toastEl.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastEl.hidden = true), seconds * 1000);
  }
}
