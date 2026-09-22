/**
 * 残像の窓: 風景の色の変換（シェーダと同じ式の JS 版。単体テスト用）と、進行のタイミング。
 * 色は sRGB（0〜1）で扱い、YCbCr の色差を反転・強調して補色の風景を作る。
 */

export const FIXATION_SECONDS = 20;
export const AFTER_SECONDS = 10;
/** 補色版の色差の強調 */
export const CHROMA_GAIN = 1.25;

export type Rgb = [number, number, number];

export function luma([r, g, b]: Rgb): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 輝度を保ったまま色差を反転する（補色） */
export function complement(c: Rgb, gain = CHROMA_GAIN): Rgb {
  const y = luma(c);
  return c.map((v) => clamp01(y - (v - y) * gain)) as Rgb;
}

export function grayscale(c: Rgb): Rgb {
  const y = luma(c);
  return [y, y, y];
}

export type AfterimagePhase = 'idle' | 'fixate' | 'after' | 'diagram';

/** 経過時間から段階と進み具合を求める */
export function phaseAt(elapsed: number): { phase: AfterimagePhase; progress: number } {
  if (elapsed < 0) return { phase: 'idle', progress: 0 };
  if (elapsed < FIXATION_SECONDS) return { phase: 'fixate', progress: elapsed / FIXATION_SECONDS };
  if (elapsed < FIXATION_SECONDS + AFTER_SECONDS) {
    return { phase: 'after', progress: (elapsed - FIXATION_SECONDS) / AFTER_SECONDS };
  }
  return { phase: 'idle', progress: 0 };
}
