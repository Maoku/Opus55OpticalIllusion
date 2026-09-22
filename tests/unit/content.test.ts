import { describe, expect, it } from 'vitest';
import { EXHIBITS, getContent } from '../../src/content/exhibits.ja';
import { EXHIBIT_IDS, isExhibitId } from '../../src/content/types';

/** 文字列 a と b に共通する、長さ n 以上の部分文字列があるか */
function sharesSubstring(a: string, b: string, n: number): string | null {
  for (let i = 0; i + n <= a.length; i++) {
    const part = a.slice(i, i + n);
    if (/^[\s、。「」（）]+$/.test(part)) continue;
    if (b.includes(part)) return part;
  }
  return null;
}

describe('content/exhibits.ja', () => {
  it('展示が 11 点以上ある（R5）', () => {
    expect(EXHIBITS.length).toBeGreaterThanOrEqual(11);
  });

  it('オリジナル作品を含む', () => {
    expect(EXHIBITS.some((e) => e.kind === 'original')).toBe(true);
  });

  it('ID と作品番号が重複しない', () => {
    expect(new Set(EXHIBITS.map((e) => e.id)).size).toBe(EXHIBITS.length);
    expect(new Set(EXHIBITS.map((e) => e.number)).size).toBe(EXHIBITS.length);
  });

  it('すべての ExhibitId に文言がある', () => {
    for (const id of EXHIBIT_IDS) expect(getContent(id).id).toBe(id);
    expect(isExhibitId('cafe-wall')).toBe(true);
    expect(isExhibitId('nope')).toBe(false);
  });

  it.each(EXHIBITS.map((e) => [e.number, e] as const))('%s: 必須項目がそろっている', (_n, e) => {
    expect(e.title.trim()).not.toBe('');
    expect(e.titleEn.trim()).not.toBe('');
    expect(e.howToView.trim()).not.toBe('');
    expect(e.hint.appearance.trim().length).toBeGreaterThan(20);
    expect(e.hint.mechanism.trim().length).toBeGreaterThan(40);
    if (e.kind === 'classic') expect(e.credit, 'classic には出典が必要').toBeTruthy();
    expect(e.number).toMatch(/^[EABC]-\d$/);
  });

  it.each(EXHIBITS.map((e) => [e.number, e] as const))(
    '%s: 鑑賞のしかたにヒントの文が含まれていない（ネタバレ防止）',
    (_n, e) => {
      expect(sharesSubstring(e.hint.appearance, e.howToView, 10)).toBeNull();
      expect(sharesSubstring(e.hint.mechanism, e.howToView, 10)).toBeNull();
    },
  );

  it.each(EXHIBITS.map((e) => [e.number, e] as const))(
    '%s: 見え方のヒントで個人差に触れている',
    (_n, e) => {
      expect(e.hint.appearance).toMatch(/個人差|異常ではありません|見えにくい|立ち直して/);
    },
  );
});
