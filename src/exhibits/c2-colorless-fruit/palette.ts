/**
 * 色のない果実の色設計（線形 RGB、0〜1）。
 *
 * 部屋全体をシアン（赤の成分が弱い光）で照らす。画面の色 = アルベド × 光の色 × 明るさ なので、
 * 各面のアルベドを「光を掛けたあと R ≤ min(G, B)」になるように選ぶ。
 * この条件は明るさを変えても、2 つの色を混ぜても（アンチエイリアス）保たれるので、
 * 画面に赤が優位なピクセルは 1 つも現れない。
 */

export type Rgb = readonly [number, number, number];

/** シアンの照明（赤を 28% に抑える） */
export const CYAN_LIGHT: Rgb = [0.28, 1, 1];
export const WHITE_LIGHT: Rgb = [1, 1, 1];
/** 環境光の強さ（光の色に対する倍率） */
export const AMBIENT = 0.38;
/** 平行光の強さ */
export const DIFFUSE = 0.85;

export const ALBEDO = {
  strawberry: [0.8, 0.235, 0.245],
  seed: [0.78, 0.72, 0.36],
  apple: [0.72, 0.21, 0.225],
  cherry: [0.62, 0.185, 0.2],
  calyx: [0.16, 0.42, 0.12],
  grape: [0.36, 0.56, 0.26],
  stem: [0.3, 0.22, 0.12],
  plate: [0.82, 0.8, 0.76],
  cloth: [0.8, 0.78, 0.72],
  table: [0.46, 0.33, 0.2],
  wall: [0.8, 0.77, 0.72],
  wainscot: [0.42, 0.4, 0.36],
  floor: [0.3, 0.28, 0.25],
  ceiling: [0.78, 0.76, 0.72],
  frame: [0.2, 0.15, 0.1],
  canvasBlue: [0.2, 0.42, 0.62],
  canvasGreen: [0.3, 0.52, 0.34],
  canvasSand: [0.7, 0.62, 0.45],
} satisfies Record<string, Rgb>;

export type AlbedoName = keyof typeof ALBEDO;

/** 光を当てたときの色（線形） */
export function lit(albedo: Rgb, light: Rgb, brightness = 1): Rgb {
  return [
    albedo[0] * light[0] * brightness,
    albedo[1] * light[1] * brightness,
    albedo[2] * light[2] * brightness,
  ];
}

/** 赤が優位か（R が G と B の両方より margin 以上大きい） */
export function isRedDominant(c: Rgb, margin = 0): boolean {
  return c[0] > c[1] + margin && c[0] > c[2] + margin;
}

/** 混ぜても赤が優位にならない、より強い条件 */
export function isSafe(c: Rgb): boolean {
  return c[0] <= Math.min(c[1], c[2]);
}

/** sRGB（0〜255） */
export function toSrgb8(c: Rgb): [number, number, number] {
  const f = (l: number) => {
    const v = Math.min(1, Math.max(0, l));
    const s = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(s * 255);
  };
  return [f(c[0]), f(c[1]), f(c[2])];
}
