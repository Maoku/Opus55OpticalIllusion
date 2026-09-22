import type { HintStage, Store } from '../app/store';
import type { ExhibitContent, ExhibitId } from '../content/types';
import type { PanelAction } from '../exhibits/types';
import { h, show } from './dom';

export interface ExhibitPanelSource {
  content(id: ExhibitId): ExhibitContent;
  hasDemo(id: ExhibitId): boolean;
  actions(id: ExhibitId): PanelAction[];
}

export interface ExhibitPanelActions {
  close(): void;
  prev(): void;
  next(): void;
  setHintStage(stage: HintStage): void;
  toggleDemo(): void;
}

/**
 * 鑑賞モードの作品パネル（§7.2）。
 * 見え方のヒントは鑑賞を始めるたびに閉じた状態から始まり、ボタンでだけ開く。
 */
export class ExhibitPanel {
  readonly el: HTMLElement;
  private readonly number: HTMLElement;
  private readonly kind: HTMLElement;
  private readonly title: HTMLElement;
  private readonly titleEn: HTMLElement;
  private readonly credit: HTMLElement;
  private readonly howTo: HTMLElement;
  private readonly caution: HTMLElement;
  private readonly viewed: HTMLElement;
  private readonly actionsBox: HTMLElement;
  private readonly hintToggle: HTMLButtonElement;
  private readonly hintBody: HTMLElement;
  private readonly appearance: HTMLElement;
  private readonly mechToggle: HTMLButtonElement;
  private readonly mechBody: HTMLElement;
  private readonly mechanism: HTMLElement;
  private readonly demoBtn: HTMLButtonElement;
  private readonly demoLabel: HTMLElement;
  private renderedId: ExhibitId | null = null;

  constructor(
    private readonly store: Store,
    private readonly source: ExhibitPanelSource,
    actions: ExhibitPanelActions,
  ) {
    this.number = h('span', { class: 'panel__number' });
    this.kind = h('span', { class: 'panel__kind' });
    this.viewed = h('span', { class: 'panel__viewed', text: 'ヒント閲覧済み' });
    this.title = h('h2', {
      class: 'panel__title',
      id: 'panel-title',
      attrs: { tabindex: -1, 'data-testid': 'panel-title' },
    });
    this.titleEn = h('p', { class: 'panel__title-en' });
    this.credit = h('p', { class: 'panel__credit' });
    this.howTo = h('p', { class: 'panel__howto', attrs: { 'data-testid': 'how-to-view' } });
    this.caution = h('p', { class: 'panel__caution', attrs: { role: 'note' } });
    this.actionsBox = h('div', { class: 'panel__actions' });

    this.appearance = h('p', { class: 'panel__hint-text', attrs: { 'data-testid': 'appearance' } });
    this.mechanism = h('p', { class: 'panel__hint-text', attrs: { 'data-testid': 'mechanism' } });

    this.mechBody = h(
      'div',
      {
        class: 'panel__mechanism',
        id: 'hint-mechanism',
        attrs: { 'data-testid': 'mechanism-body' },
      },
      [h('h4', { text: 'なぜ？' }), this.mechanism],
    );
    this.mechToggle = h('button', {
      class: 'disclosure disclosure--sub',
      attrs: {
        type: 'button',
        'aria-expanded': 'false',
        'aria-controls': 'hint-mechanism',
        'data-testid': 'mechanism-toggle',
      },
      on: {
        click: () =>
          actions.setHintStage(
            this.store.get().hintStage === 'mechanism' ? 'appearance' : 'mechanism',
          ),
      },
    });
    this.demoLabel = h('span', { class: 'demo__label' });
    this.demoBtn = h(
      'button',
      {
        class: 'btn btn--demo',
        attrs: { type: 'button', 'data-testid': 'demo' },
        on: { click: () => actions.toggleDemo() },
      },
      [],
    );

    this.hintBody = h(
      'div',
      { class: 'panel__hint', id: 'hint-body', attrs: { 'data-testid': 'hint-body' } },
      [
        h('h4', { text: 'どう見える？' }),
        this.appearance,
        this.mechToggle,
        this.mechBody,
        h('div', { class: 'panel__demo' }, [this.demoBtn, this.demoLabel]),
      ],
    );
    this.hintToggle = h('button', {
      class: 'disclosure',
      attrs: {
        type: 'button',
        'aria-expanded': 'false',
        'aria-controls': 'hint-body',
        'data-testid': 'hint-toggle',
      },
      on: {
        click: () =>
          actions.setHintStage(this.store.get().hintStage === 'hidden' ? 'appearance' : 'hidden'),
      },
    });

    const nav = h('nav', { class: 'panel__nav', attrs: { 'aria-label': '作品の移動' } }, [
      h('button', {
        class: 'btn btn--ghost',
        text: '← 前の作品',
        attrs: { type: 'button', 'data-testid': 'prev-exhibit' },
        on: { click: () => actions.prev() },
      }),
      h('button', {
        class: 'btn btn--primary',
        text: '戻る',
        attrs: { type: 'button', 'data-testid': 'close-exhibit' },
        on: { click: () => actions.close() },
      }),
      h('button', {
        class: 'btn btn--ghost',
        text: '次の作品 →',
        attrs: { type: 'button', 'data-testid': 'next-exhibit' },
        on: { click: () => actions.next() },
      }),
    ]);

    this.el = h(
      'aside',
      {
        class: 'panel',
        attrs: { 'aria-labelledby': 'panel-title', 'data-testid': 'exhibit-panel' },
      },
      [
        h('div', { class: 'panel__scroll' }, [
          h('div', { class: 'panel__meta' }, [this.number, this.kind, this.viewed]),
          this.title,
          this.titleEn,
          this.credit,
          h('section', { class: 'panel__section' }, [
            h('h3', { text: '鑑賞のしかた' }),
            this.howTo,
            this.caution,
            this.actionsBox,
          ]),
          h('section', { class: 'panel__section panel__section--hint' }, [
            this.hintToggle,
            this.hintBody,
          ]),
        ]),
        nav,
      ],
    );

    store.subscribe(() => this.render());
    this.render();
  }

  private render(): void {
    const s = this.store.get();
    const id = s.activeExhibitId as ExhibitId | null;
    const visible = s.mode === 'viewing' && id !== null;
    show(this.el, visible);
    if (!visible || !id) {
      this.renderedId = null;
      return;
    }

    if (this.renderedId !== id) {
      this.renderedId = id;
      const c = this.source.content(id);
      this.number.textContent = c.number;
      this.kind.textContent = c.kind === 'original' ? 'オリジナル' : '古典';
      this.kind.classList.toggle('panel__kind--original', c.kind === 'original');
      this.title.textContent = c.title;
      this.titleEn.textContent = c.titleEn;
      this.credit.textContent = c.credit ?? '';
      show(this.credit, !!c.credit);
      this.howTo.textContent = c.howToView;
      this.caution.textContent = c.caution ? `⚠ ${c.caution}` : '';
      show(this.caution, !!c.caution);
      this.appearance.textContent = c.hint.appearance;
      this.mechanism.textContent = c.hint.mechanism;
      this.demoLabel.textContent = c.demoLabel ?? '';
      this.actionsBox.replaceChildren(
        ...this.source.actions(id).map((a) =>
          h('button', {
            class: 'btn btn--primary',
            text: a.label,
            attrs: { type: 'button', 'data-testid': `action-${a.id}` },
            on: { click: () => void a.run() },
          }),
        ),
      );
      show(this.actionsBox, this.actionsBox.childElementCount > 0);
      this.el.querySelector('.panel__scroll')?.scrollTo({ top: 0 });
      this.title.focus({ preventScroll: true });
    }

    const stage = s.hintStage;
    const open = stage !== 'hidden';
    this.hintToggle.setAttribute('aria-expanded', String(open));
    this.hintToggle.textContent = open ? 'ヒントを隠す' : '見え方のヒント';
    this.hintBody.hidden = !open;
    const mech = stage === 'mechanism';
    this.mechToggle.setAttribute('aria-expanded', String(mech));
    this.mechToggle.textContent = mech ? 'しくみを閉じる' : 'しくみを知る';
    this.mechBody.hidden = !mech;

    const demo = this.source.hasDemo(id);
    show(this.demoBtn.parentElement!, demo);
    this.demoBtn.textContent = s.demoPlaying ? '■ 止める' : '▶ 確かめる';
    this.demoBtn.setAttribute('aria-pressed', String(s.demoPlaying));
    show(this.viewed, s.hintViewed.includes(id));
  }
}
