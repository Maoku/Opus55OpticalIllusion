import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/** WCAG 2.x の相対輝度とコントラスト比 */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

const base = readFileSync('src/styles/base.css', 'utf8');
const ui = readFileSync('src/styles/ui.css', 'utf8');
const css = base + ui;
const cssVar = (name: string) => {
  const m = css.match(new RegExp(`--${name}:[ \\t]*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`--${name} が見つかりません`);
  return m[1]!;
};

describe('UI の文字のコントラスト比が 4.5:1 以上（§7.4）', () => {
  const panel = cssVar('c-panel-solid');
  const pairs: [string, string, string][] = [
    ['本文', cssVar('c-ink'), panel],
    ['補足の文字', cssVar('c-ink-sub'), panel],
    ['背景色の上の補足の文字', cssVar('c-ink-sub'), cssVar('c-bg')],
    ['注意書き', cssVar('c-caution-ink'), cssVar('c-caution-bg')],
    ['主ボタン', '#ffffff', cssVar('c-ink')],
    ['デモのボタン', '#ffffff', '#1f4fd8'],
    ['ヒントの見出し', '#1f4fd8', panel],
    ['閲覧済みの印', '#166534', panel],
    ['オリジナルの区分', '#9a3412', panel],
    ['お知らせ', '#ffffff', '#141416'],
    ['マップのゾーン名', '#55555a', '#e7eef6'],
  ];

  it.each(pairs)('%s', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('CSS に記載された色を使っている', () => {
    for (const [, fg, bg] of pairs) {
      for (const c of [fg, bg]) {
        if (c === '#ffffff' || c === '#141416') continue;
        expect(css.toLowerCase()).toContain(c.toLowerCase());
      }
    }
  });
});
