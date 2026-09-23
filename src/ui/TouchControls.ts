import type { Store } from '../app/store';
import type { InputManager } from '../core/input';
import { h, show } from './dom';

/** タッチ端末用のバーチャルスティック（左下）。歩行モードでだけ表示する */
export class TouchControls {
  readonly el: HTMLElement;
  private readonly knob: HTMLElement;
  private pointer: number | null = null;
  private cx = 0;
  private cy = 0;

  constructor(store: Store, input: InputManager, enabled: boolean) {
    this.knob = h('div', { class: 'stick__knob' });
    const base = h('div', { class: 'stick__base' }, [this.knob]);
    this.el = h(
      'div',
      {
        class: 'stick',
        attrs: { 'aria-label': '移動（ドラッグ）', role: 'application', 'data-testid': 'stick' },
      },
      [base],
    );
    const radius = () => base.clientWidth / 2;
    const move = (e: PointerEvent) => {
      const r = radius();
      let dx = e.clientX - this.cx;
      let dy = e.clientY - this.cy;
      const len = Math.hypot(dx, dy);
      if (len > r) {
        dx = (dx / len) * r;
        dy = (dy / len) * r;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      input.setStick(dx / r, -dy / r);
    };
    const end = () => {
      this.pointer = null;
      this.knob.style.transform = '';
      input.setStick(0, 0);
    };
    base.addEventListener('pointerdown', (e) => {
      if (this.pointer !== null) return;
      this.pointer = e.pointerId;
      base.setPointerCapture(e.pointerId);
      const rect = base.getBoundingClientRect();
      this.cx = rect.left + rect.width / 2;
      this.cy = rect.top + rect.height / 2;
      move(e);
      e.preventDefault();
    });
    base.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.pointer) move(e);
    });
    base.addEventListener('pointerup', (e) => {
      if (e.pointerId === this.pointer) end();
    });
    base.addEventListener('pointercancel', end);

    const render = () => {
      const walking = store.get().mode === 'walking';
      show(this.el, enabled && walking);
      if (!walking && this.pointer !== null) end();
    };
    store.subscribe(render);
    render();
  }
}
