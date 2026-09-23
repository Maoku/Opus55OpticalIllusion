import { describe, expect, it } from 'vitest';
import { parseSaved } from '../../src/app/persistence';
import { DEFAULT_SETTINGS } from '../../src/app/store';

describe('persistence.parseSaved', () => {
  it('保存がなければ既定値', () => {
    expect(parseSaved(null)).toEqual({ settings: DEFAULT_SETTINGS, visited: [], hintViewed: [] });
  });

  it('壊れた JSON は既定値に戻す', () => {
    expect(parseSaved('{oops').settings).toEqual(DEFAULT_SETTINGS);
    expect(parseSaved('42').visited).toEqual([]);
  });

  it('範囲外の数値は丸め、型の違う値は既定値にする', () => {
    const s = parseSaved(
      JSON.stringify({
        settings: {
          fov: 500,
          mouseSensitivity: -1,
          invertY: 'yes',
          quality: 'ultra',
          muted: false,
        },
        visited: ['cafe-wall', 3, null],
      }),
    );
    expect(s.settings.fov).toBe(100);
    expect(s.settings.mouseSensitivity).toBe(0.2);
    expect(s.settings.invertY).toBe(DEFAULT_SETTINGS.invertY);
    expect(s.settings.quality).toBe('auto');
    expect(s.settings.muted).toBe(false);
    expect(s.visited).toEqual(['cafe-wall']);
  });

  it('正しい値はそのまま読める', () => {
    const data = {
      settings: { ...DEFAULT_SETTINGS, reducedMotion: true, fov: 80, quality: 'low' },
      visited: ['ebbinghaus'],
      hintViewed: ['ebbinghaus'],
    };
    expect(parseSaved(JSON.stringify(data))).toEqual(data);
  });
});
