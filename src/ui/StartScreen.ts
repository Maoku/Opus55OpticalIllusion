import type { Settings, Store } from '../app/store';
import { h, show } from './dom';

export class StartScreen {
  readonly el: HTMLElement;
  readonly enterButton: HTMLButtonElement;

  constructor(store: Store, onEnter: () => void, onSettings: (patch: Partial<Settings>) => void) {
    const toggle = (id: string, label: string, onChange: (v: boolean) => void) => {
      const input = h('input', { id, attrs: { type: 'checkbox' } });
      input.addEventListener('change', () => onChange(input.checked));
      return {
        input,
        el: h('label', { class: 'start__toggle', attrs: { for: id } }, [input, label]),
      };
    };
    const reduced = toggle('start-reduced', '動きを減らす', (v) =>
      onSettings({ reducedMotion: v }),
    );
    const sound = toggle('start-sound', 'サウンド（環境音・足音）', (v) =>
      onSettings({ muted: !v }),
    );
    this.enterButton = h('button', {
      class: 'btn btn--primary btn--large',
      text: '入館する',
      attrs: { type: 'button', 'data-testid': 'enter' },
      on: { click: () => onEnter() },
    });

    this.el = h('section', { class: 'screen start', attrs: { 'aria-labelledby': 'start-title' } }, [
      h('div', { class: 'start__panel' }, [
        h('header', { class: 'start__header' }, [
          h('p', { class: 'brand-mark', text: 'OPTICAL ILLUSION MUSEUM' }),
          h('h1', { id: 'start-title', class: 'start__title', text: '錯視美術館' }),
          h('p', {
            class: 'start__lead',
            text: '目はときどき、ありえないものを見ます。館内を歩きながら、錯視をテーマにした作品をお楽しみください。各作品の「見え方のヒント」は、ボタンを押すまで隠れています。',
          }),
        ]),
        h('div', { class: 'start__grid' }, [
          h('section', { class: 'start__block' }, [
            h('h2', { text: '操作' }),
            h('dl', { class: 'keys keys--desktop' }, [
              h('dt', { text: 'W A S D / 矢印' }),
              h('dd', { text: '歩く（Shift で早歩き）' }),
              h('dt', { text: 'マウス' }),
              h('dd', { text: '見回す（画面をクリックで開始）' }),
              h('dt', { text: 'E / クリック' }),
              h('dd', { text: '近くの作品を鑑賞する' }),
              h('dt', { text: 'H' }),
              h('dd', { text: '見え方のヒント' }),
              h('dt', { text: 'Esc / Q' }),
              h('dd', { text: '鑑賞をやめる' }),
              h('dt', { text: 'M' }),
              h('dd', { text: 'フロアマップ' }),
            ]),
            h('dl', { class: 'keys keys--touch' }, [
              h('dt', { text: '左下のスティック' }),
              h('dd', { text: '歩く' }),
              h('dt', { text: '画面をドラッグ' }),
              h('dd', { text: '見回す' }),
              h('dt', { text: '作品をタップ' }),
              h('dd', { text: '鑑賞する' }),
            ]),
          ]),
          h('section', { class: 'start__block start__caution', attrs: { role: 'note' } }, [
            h('h2', { text: 'ご鑑賞の前に' }),
            h('ul', {}, [
              h('li', {
                text: '一部の作品には、ちらつきや動いて見える図柄があります。光に敏感な方は、気分が悪くなったらすぐに鑑賞をやめてください。',
              }),
              h('li', {
                text: '3D 空間の移動で酔いやすい方は、下の「動きを減らす」をオンにしてください（あとから設定でも変えられます）。',
              }),
              h('li', {
                text: '錯視の見え方には個人差があります。うまく見えなくても異常ではありません。',
              }),
            ]),
          ]),
        ]),
        h('div', { class: 'start__actions' }, [
          h('div', { class: 'start__toggles' }, [reduced.el, sound.el]),
          this.enterButton,
        ]),
      ]),
    ]);

    const render = () => {
      const st = store.get();
      show(this.el, st.mode === 'start');
      reduced.input.checked = st.settings.reducedMotion;
      sound.input.checked = !st.settings.muted;
    };
    store.subscribe(render);
    render();
  }
}
