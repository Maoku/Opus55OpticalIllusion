import type { Vec3, ViewMode } from './types';

/** 平面作品の鑑賞で使う垂直視野角（度）。狭めにして斜めの歪みを抑える */
export const FRONT_FOV = 42;
/** 作品が画面に占める割合（§4.6） */
export const FRONT_FILL = 0.7;

export interface LocalPose {
  position: Vec3;
  target: Vec3;
  fov: number;
}

/**
 * 幅 width × 高さ height の作品面が、空いている領域（freeW × freeH px）の fill 倍に収まる距離。
 * focalPx は投影の焦点距離（px）。
 */
export function frontDistance(
  width: number,
  height: number,
  focalPx: number,
  freeW: number,
  freeH: number,
  fill = FRONT_FILL,
): number {
  return Math.max((width * focalPx) / (fill * freeW), (height * focalPx) / (fill * freeH));
}

/** 視野角と画面の高さから焦点距離（px）を求める */
export function focalFromFov(fovDeg: number, fullHeightPx: number): number {
  return fullHeightPx / 2 / Math.tan(((fovDeg * Math.PI) / 180) * 0.5);
}

export interface ViewportSpec {
  /** キャンバスの大きさ（px） */
  width: number;
  height: number;
  /** パネルが覆う右端・下端の大きさ（px） */
  insetRight: number;
  insetBottom: number;
}

/** 鑑賞モードの推奨視点（展示ローカル座標） */
export function localViewPose(mode: ViewMode, vp: ViewportSpec): LocalPose {
  if (mode.kind === 'fixed') {
    return { position: mode.position, target: mode.target, fov: mode.fov };
  }
  const fov = mode.fov ?? FRONT_FOV;
  const focal = focalFromFov(fov, vp.height + vp.insetBottom);
  const freeW = Math.max(120, vp.width - vp.insetRight);
  const freeH = Math.max(120, vp.height - vp.insetBottom);
  const d = frontDistance(mode.width, mode.height, focal, freeW, freeH, mode.fill ?? FRONT_FILL);
  const [cx, cy, cz] = mode.center;
  return { position: [cx, cy, cz + d], target: [cx, cy, cz], fov };
}

/** 平面作品の画面上の大きさ（px）。テスト・調整用 */
export function projectedSize(
  width: number,
  height: number,
  distance: number,
  focalPx: number,
): { w: number; h: number } {
  return { w: (width * focalPx) / distance, h: (height * focalPx) / distance };
}
