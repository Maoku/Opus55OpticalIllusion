import type { Store } from '../app/store';
import { h, show } from './dom';

export class LoadingScreen {
  readonly el: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly label: HTMLElement;

  constructor(store: Store) {
    this.bar = h('div', { class: 'loading__bar-fill' });
    this.label = h('p', { class: 'loading__label', text: '準備しています… 0%' });
    this.el = h('section', { class: 'screen loading', attrs: { 'aria-live': 'polite' } }, [
      h('div', { class: 'loading__inner' }, [
        h('p', { class: 'brand-mark', text: 'OPTICAL ILLUSION MUSEUM' }),
        h(
          'div',
          {
            class: 'loading__bar',
            attrs: { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 },
          },
          [this.bar],
        ),
        this.label,
      ]),
    ]);
    const render = () => {
      const s = store.get();
      show(this.el, s.mode === 'loading');
      const pct = Math.round(s.loadingProgress * 100);
      this.bar.style.transform = `scaleX(${s.loadingProgress})`;
      this.bar.parentElement?.setAttribute('aria-valuenow', String(pct));
      this.label.textContent = `準備しています… ${pct}%`;
    };
    store.subscribe(render);
    render();
  }
}
