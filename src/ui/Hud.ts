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
    this.el = h('div', { class: 'hud' }, [this.crosshair, this.zone, this.prompt]);

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
}
