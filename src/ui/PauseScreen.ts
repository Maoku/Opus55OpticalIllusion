import type { Store } from '../app/store';
import { h, show } from './dom';

export interface PauseActions {
  resume(): void;
  openSettings(): void;
  openMap(): void;
}

export class PauseScreen {
  readonly el: HTMLElement;

  constructor(store: Store, actions: PauseActions) {
    const resume = h('button', {
      class: 'btn btn--primary',
      text: 'クリックして再開',
      attrs: { type: 'button', 'data-testid': 'resume' },
      on: { click: () => actions.resume() },
    });
    this.el = h('section', { class: 'screen pause', attrs: { 'aria-labelledby': 'pause-title' } }, [
      h('div', { class: 'pause__panel' }, [
        h('h2', { id: 'pause-title', text: '一時停止中' }),
        resume,
        h('div', { class: 'pause__row' }, [
          h('button', {
            class: 'btn',
            text: 'フロアマップ',
            attrs: { type: 'button' },
            on: { click: () => actions.openMap() },
          }),
          h('button', {
            class: 'btn',
            text: '設定',
            attrs: { type: 'button' },
            on: { click: () => actions.openSettings() },
          }),
        ]),
      ]),
    ]);
    // パネルの外をクリックしても再開する
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) actions.resume();
    });

    const render = () => show(this.el, store.get().mode === 'paused');
    store.subscribe(render);
    render();
  }
}
