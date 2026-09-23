import type { QualitySetting, Settings, Store } from '../app/store';
import { h, show } from './dom';

export interface SettingsActions {
  update(patch: Partial<Settings>): void;
  close(): void;
  resetProgress(): void;
}

const QUALITY_LABELS: Record<QualitySetting, string> = {
  auto: '自動',
  low: '低',
  medium: '中',
  high: '高',
};

/** 設定: 画質・マウス感度・視野角・上下反転・動きを減らす・サウンド */
export class SettingsPanel {
  readonly el: HTMLElement;
  private readonly inputs: {
    quality: HTMLSelectElement;
    sensitivity: HTMLInputElement;
    sensitivityOut: HTMLOutputElement;
    fov: HTMLInputElement;
    fovOut: HTMLOutputElement;
    invertY: HTMLInputElement;
    reducedMotion: HTMLInputElement;
    sound: HTMLInputElement;
  };

  constructor(
    private readonly store: Store,
    actions: SettingsActions,
  ) {
    const quality = h(
      'select',
      {
        id: 'set-quality',
        on: { change: () => actions.update({ quality: quality.value as QualitySetting }) },
      },
      (Object.keys(QUALITY_LABELS) as QualitySetting[]).map((q) =>
        h('option', { text: QUALITY_LABELS[q], attrs: { value: q } }),
      ),
    );
    const sensitivityOut = h('output', { attrs: { for: 'set-sensitivity' } });
    const sensitivity = h('input', {
      id: 'set-sensitivity',
      attrs: { type: 'range', min: 0.3, max: 2.5, step: 0.1 },
      on: { input: () => actions.update({ mouseSensitivity: Number(sensitivity.value) }) },
    });
    const fovOut = h('output', { attrs: { for: 'set-fov' } });
    const fov = h('input', {
      id: 'set-fov',
      attrs: { type: 'range', min: 55, max: 95, step: 1 },
      on: { input: () => actions.update({ fov: Number(fov.value) }) },
    });
    const check = (id: string, onChange: (v: boolean) => void) => {
      const el = h('input', { id, attrs: { type: 'checkbox' } });
      el.addEventListener('change', () => onChange(el.checked));
      return el;
    };
    const invertY = check('set-invert', (v) => actions.update({ invertY: v }));
    const reducedMotion = check('set-reduced', (v) => actions.update({ reducedMotion: v }));
    const sound = check('set-sound', (v) => actions.update({ muted: !v }));
    this.inputs = {
      quality,
      sensitivity,
      sensitivityOut,
      fov,
      fovOut,
      invertY,
      reducedMotion,
      sound,
    };

    const row = (
      label: string,
      forId: string,
      control: HTMLElement,
      extra?: HTMLElement,
      note?: string,
    ) =>
      h('div', { class: 'settings__row' }, [
        h('label', { text: label, attrs: { for: forId } }),
        h('div', { class: 'settings__control' }, [control, extra ?? null]),
        note ? h('p', { class: 'settings__note', text: note }) : null,
      ]);

    this.el = h(
      'section',
      {
        class: 'screen overlay settings',
        attrs: {
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'settings-title',
          'data-testid': 'settings',
        },
      },
      [
        h('div', { class: 'overlay__panel settings__panel' }, [
          h('header', { class: 'overlay__header' }, [
            h('h2', { id: 'settings-title', text: '設定' }),
            h('button', {
              class: 'btn',
              text: '閉じる',
              attrs: { type: 'button', 'data-testid': 'settings-close' },
              on: { click: () => actions.close() },
            }),
          ]),
          row(
            '画質',
            'set-quality',
            quality,
            undefined,
            '「自動」は動作の重さに合わせて画質を下げます。',
          ),
          row('マウス感度', 'set-sensitivity', sensitivity, sensitivityOut),
          row('視野角', 'set-fov', fov, fovOut),
          row('上下の操作を反転', 'set-invert', invertY),
          row(
            '動きを減らす',
            'set-reduced',
            reducedMotion,
            undefined,
            'カメラの移動をフェードに置き換え、作品の動きを控えめにします。',
          ),
          row('サウンド（環境音・足音）', 'set-sound', sound),
          h('div', { class: 'settings__footer' }, [
            h('button', {
              class: 'btn btn--ghost',
              text: '鑑賞の記録を消す',
              attrs: { type: 'button' },
              on: { click: () => actions.resetProgress() },
            }),
          ]),
        ]),
      ],
    );
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) actions.close();
    });

    const render = () => {
      const s = this.store.get();
      const open = s.mode === 'settings';
      const wasHidden = this.el.hidden;
      show(this.el, open);
      if (!open) return;
      const st = s.settings;
      const i = this.inputs;
      i.quality.value = st.quality;
      i.sensitivity.value = String(st.mouseSensitivity);
      i.sensitivityOut.textContent = `${st.mouseSensitivity.toFixed(1)}×`;
      i.fov.value = String(st.fov);
      i.fovOut.textContent = `${Math.round(st.fov)}°`;
      i.invertY.checked = st.invertY;
      i.reducedMotion.checked = st.reducedMotion;
      i.sound.checked = !st.muted;
      if (wasHidden) i.quality.focus({ preventScroll: true });
    };
    store.subscribe(render);
    render();
  }
}
