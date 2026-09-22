import { describe, expect, it } from 'vitest';
import { REGISTRY, registeredIds } from '../../src/exhibits/registry';
import { EXHIBIT_IDS } from '../../src/content/types';
import { EXHIBITS } from '../../src/content/exhibits.ja';

describe('registry', () => {
  it('11 点以上の展示が登録されている（R5）', () => {
    expect(registeredIds().length).toBeGreaterThanOrEqual(11);
  });

  it('すべての展示 ID に実装がある', () => {
    for (const id of EXHIBIT_IDS) expect(REGISTRY[id], id).toBeTypeOf('function');
  });

  it('オリジナル作品が 4 点ある', () => {
    expect(EXHIBITS.filter((e) => e.kind === 'original' && REGISTRY[e.id])).toHaveLength(4);
  });

  it.each(EXHIBIT_IDS.map((id) => [id]))(
    '%s: コンストラクタは DOM に触れずに生成でき、ID が一致する',
    (id) => {
      const ex = REGISTRY[id]!();
      expect(ex.id).toBe(id);
      expect(ex.root).toBeDefined();
    },
  );
});
