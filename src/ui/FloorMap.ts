import type { Store } from '../app/store';
import { EXHIBITS } from '../content/exhibits.ja';
import type { ExhibitId } from '../content/types';
import { EXHIBIT_PLACEMENTS, ROOMS, ZONES, bounds, type ZoneId } from '../world/layout';
import { h, show } from './dom';

export interface FloorMapActions {
  close(): void;
  warp(id: ExhibitId): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  children: (SVGElement | string)[] = [],
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children) el.append(c);
  return el;
}

const ZONE_FILL: Record<ZoneId, string> = {
  entrance: '#ecebe6',
  hall: '#f3efe6',
  corridor: '#ecebe6',
  zoneA: '#e7eef6',
  zoneB: '#eef3e8',
  zoneC: '#f6ece6',
};

/** フロアマップ: ゾーン・作品の位置・鑑賞済みの印。作品を選ぶとその鑑賞モードへワープする */
export class FloorMap {
  readonly el: HTMLElement;
  private readonly markers = new Map<ExhibitId, SVGGElement>();
  private readonly items = new Map<ExhibitId, HTMLButtonElement>();
  private readonly player: SVGGElement;
  private readonly closeBtn: HTMLButtonElement;

  constructor(
    store: Store,
    private readonly actions: FloorMapActions,
    private readonly getPlayer: () => { x: number; z: number; yaw: number },
  ) {
    const b = bounds(ROOMS);
    const pad = 2;
    const map = svg('svg', {
      class: 'map__svg',
      viewBox: `${b.x0 - pad} ${b.z0 - pad} ${b.x1 - b.x0 + pad * 2} ${b.z1 - b.z0 + pad * 2}`,
      role: 'img',
      'aria-labelledby': 'map-title',
    });
    for (const r of ROOMS) {
      map.append(
        svg('rect', {
          x: r.rect.x0,
          y: r.rect.z0,
          width: r.rect.x1 - r.rect.x0,
          height: r.rect.z1 - r.rect.z0,
          fill: r.dark ? '#3a3a3e' : ZONE_FILL[r.zone],
          stroke: '#9a978f',
          'stroke-width': 0.15,
        }),
      );
    }
    const labels: [ZoneId, number, number][] = [
      ['zoneA', -29, 0.6],
      ['zoneB', 26, 0.6],
      ['zoneC', -3.5, -15.3],
      ['hall', 0, 7.3],
    ];
    for (const [zone, x, y] of labels) {
      map.append(
        svg('text', { x, y, class: 'map__zone', 'text-anchor': 'middle' }, [ZONES[zone].name]),
      );
    }
    map.append(
      svg('text', { x: 0, y: 13.2, class: 'map__zone', 'text-anchor': 'middle' }, ['入口']),
    );

    const list = h('ol', { class: 'map__list' });
    for (const p of EXHIBIT_PLACEMENTS) {
      const c = EXHIBITS.find((e) => e.id === p.id)!;
      // 壁の作品は部屋の内側へ少しずらして印を置く
      const mx = p.x + Math.sin(p.rotation) * 1.2;
      const mz = p.z + Math.cos(p.rotation) * 1.2;
      const g = svg('g', {
        class: 'map__marker',
        transform: `translate(${mx} ${mz})`,
        tabindex: -1,
        'data-id': p.id,
      });
      g.append(
        svg('circle', { r: 1.35 }),
        svg('text', { 'text-anchor': 'middle', dy: 0.5 }, [c.number]),
      );
      g.addEventListener('click', () => this.actions.warp(p.id));
      map.append(g);
      this.markers.set(p.id, g);

      const btn = h(
        'button',
        {
          class: 'map__item',
          attrs: { type: 'button', 'data-testid': `map-item-${p.id}` },
          on: { click: () => this.actions.warp(p.id) },
        },
        [
          h('span', { class: 'map__num', text: c.number }),
          h('span', { class: 'map__title', text: c.title }),
          h('span', { class: 'map__visited', text: '鑑賞済み' }),
        ],
      );
      this.items.set(p.id, btn);
      list.append(h('li', {}, [btn]));
    }

    this.player = svg('g', { class: 'map__player' }, [
      svg('circle', { r: 2.2, class: 'map__player-halo' }),
      svg('path', { d: 'M 0 -1.6 L 1.1 1.1 L 0 0.5 L -1.1 1.1 Z' }),
    ]);
    map.append(this.player);

    this.closeBtn = h('button', {
      class: 'btn',
      text: '閉じる',
      attrs: { type: 'button', 'data-testid': 'map-close' },
      on: { click: () => this.actions.close() },
    });
    const visitedCount = h('p', { class: 'map__count' });
    this.el = h(
      'section',
      {
        class: 'screen overlay map',
        attrs: {
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'map-title',
          'data-testid': 'floor-map',
        },
      },
      [
        h('div', { class: 'overlay__panel map__panel' }, [
          h('header', { class: 'overlay__header' }, [
            h('h2', { id: 'map-title', text: 'フロアマップ' }),
            visitedCount,
            this.closeBtn,
          ]),
          h('div', { class: 'map__body' }, [
            h('div', { class: 'map__figure' }, [map]),
            h(
              'nav',
              { class: 'map__nav', attrs: { 'aria-label': '作品一覧（選ぶとその作品へ移動）' } },
              [list],
            ),
          ]),
        ]),
      ],
    );
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.actions.close();
    });

    const render = () => {
      const s = store.get();
      const open = s.mode === 'map';
      const wasHidden = this.el.hidden;
      show(this.el, open);
      if (!open) return;
      for (const [id, g] of this.markers) {
        const visited = s.visited.includes(id);
        g.classList.toggle('is-visited', visited);
        this.items.get(id)!.classList.toggle('is-visited', visited);
      }
      const n = EXHIBIT_PLACEMENTS.filter((p) => s.visited.includes(p.id)).length;
      visitedCount.textContent = `鑑賞済み ${n} / ${EXHIBIT_PLACEMENTS.length}`;
      const p = this.getPlayer();
      this.player.setAttribute(
        'transform',
        `translate(${p.x} ${p.z}) rotate(${(-p.yaw * 180) / Math.PI})`,
      );
      if (wasHidden) this.closeBtn.focus({ preventScroll: true });
    };
    store.subscribe(render);
    render();
  }
}
