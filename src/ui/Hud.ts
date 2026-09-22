import type { Store } from '../app/store';
import { ZONES, type ZoneId } from '../world/layout';
import { h, show } from './dom';

export class Hud {
  readonly el: HTMLElement;
  private readonly zone: HTMLElement;
  private readonly crosshair: HTMLElement;

  constructor(store: Store) {
    this.crosshair = h('div', { class: 'hud__crosshair', attrs: { 'aria-hidden': 'true' } });
    this.zone = h('p', { class: 'hud__zone', attrs: { 'aria-live': 'polite' } });
    this.el = h('div', { class: 'hud' }, [this.crosshair, this.zone]);

    const render = () => {
      const s = store.get();
      show(this.el, s.mode === 'walking' || s.mode === 'viewing');
      show(this.crosshair, s.mode === 'walking');
      const info = s.zoneId ? ZONES[s.zoneId as ZoneId] : undefined;
      this.zone.textContent = info ? info.name : '';
      show(this.zone, !!info && s.mode === 'walking');
    };
    store.subscribe(render);
    render();
  }
}
