import * as THREE from 'three';
import type { App } from './App';
import type { AppState, HintStage } from './store';
import type { ExhibitId } from '../content/types';

/**
 * テスト用 API（開発ビルドと E2E ビルドだけで有効）。
 * ヘッドレス環境ではポインタロックが使えないため、状態遷移をここから行う。
 */
export interface DebugApi {
  getState(): AppState;
  enter(): void;
  teleport(x: number, z: number, yaw?: number): void;
  getPlayer(): { x: number; z: number; yaw: number; pitch: number };
  /** 指定したキーを ms ミリ秒押し続ける */
  hold(code: string, ms: number): Promise<void>;
  fps(): number;
  renderInfo(): { calls: number; triangles: number; textures: number; geometries: number };
  /** 館内に配置されている展示（順路順） */
  exhibitIds(): ExhibitId[];
  openExhibit(id: ExhibitId): Promise<void>;
  closeExhibit(): Promise<void>;
  setHintStage(stage: HintStage): void;
  playDemo(): Promise<void>;
  /** 展示の初期化が終わるまで待つ */
  whenReady(id: ExhibitId): Promise<void>;
  /** 描画をもう 1 フレーム進める */
  nextFrame(): Promise<void>;
  /**
   * 画面上の点（CSS px）の画素値を読む（sRGB, 0〜255）。
   * E2E ビルドでは preserveDrawingBuffer が有効なので、最後に描いたフレームを読める
   */
  readPixel(x: number, y: number): [number, number, number, number];
  /** 世界座標の点を画面上の点（CSS px）に投影する */
  project(x: number, y: number, z: number): { x: number; y: number };
  /** 展示ローカル座標の点を画面上の点（CSS px）に投影する */
  projectLocal(id: ExhibitId, x: number, y: number, z: number): { x: number; y: number };
  /** 調査・撮影用: カメラを任意の姿勢に置く（歩行・鑑賞の状態はそのまま） */
  lookFrom(
    position: [number, number, number],
    target: [number, number, number],
    fov?: number,
  ): void;
  /** 展示の debugPoints を画面上の点（CSS px）に投影する */
  debugPoints(id: ExhibitId): Record<string, { x: number; y: number }>;
}

declare global {
  interface Window {
    __OIM__?: DebugApi;
  }
}

export function installDebugApi(app: App): void {
  const api: DebugApi = {
    getState: () => app.store.get(),
    enter: () => app.enter(),
    teleport: (x, z, yaw) => app.player.teleport(x, z, yaw),
    getPlayer: () => ({
      x: app.player.position.x,
      z: app.player.position.z,
      yaw: app.player.yaw,
      pitch: app.player.pitch,
    }),
    hold: (code, ms) =>
      new Promise((resolve) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        setTimeout(() => {
          window.dispatchEvent(new KeyboardEvent('keyup', { code }));
          resolve();
        }, ms);
      }),
    fps: () => app.fps,
    renderInfo: () => {
      const info = app.renderer.info;
      return {
        calls: info.render.calls,
        triangles: info.render.triangles,
        textures: info.memory.textures,
        geometries: info.memory.geometries,
      };
    },
    exhibitIds: () => app.exhibits.ids(),
    openExhibit: (id) => app.openExhibit(id),
    closeExhibit: () => app.closeExhibit(),
    setHintStage: (stage) => app.setHintStage(stage),
    playDemo: () => app.playDemo(),
    whenReady: (id) => app.exhibits.ensureReady(id),
    nextFrame: () => new Promise((r) => requestAnimationFrame(() => r())),
    readPixel: (x, y) => {
      const gl = app.renderer.getContext();
      const dpr = app.renderer.getPixelRatio();
      const px = Math.round(x * dpr);
      const py = Math.round(gl.drawingBufferHeight - y * dpr);
      const out = new Uint8Array(4);
      gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
      return [out[0]!, out[1]!, out[2]!, out[3]!];
    },
    project: (x, y, z) => project(app, x, y, z),
    projectLocal: (id, x, y, z) => {
      const entry = app.exhibits.get(id);
      if (!entry) throw new Error(`未登録の展示です: ${id}`);
      entry.group.updateMatrixWorld(true);
      const w = new THREE.Vector3(x, y, z).applyMatrix4(entry.group.matrixWorld);
      return project(app, w.x, w.y, w.z);
    },
    lookFrom: (position, target, fov) => {
      void app.rig.flyTo(
        {
          position: new THREE.Vector3(...position),
          target: new THREE.Vector3(...target),
          fov: fov ?? app.camera.fov,
        },
        0,
      );
    },
    debugPoints: (id) => {
      const entry = app.exhibits.get(id);
      if (!entry) throw new Error(`未登録の展示です: ${id}`);
      entry.group.updateMatrixWorld(true);
      const out: Record<string, { x: number; y: number }> = {};
      for (const [name, p] of Object.entries(entry.exhibit.debugPoints ?? {})) {
        const w = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(entry.group.matrixWorld);
        out[name] = project(app, w.x, w.y, w.z);
      }
      return out;
    },
  };
  window.__OIM__ = api;
}

function project(app: App, x: number, y: number, z: number): { x: number; y: number } {
  app.camera.updateMatrixWorld(true);
  const ndc = new THREE.Vector3(x, y, z).project(app.camera);
  const rect = app.renderer.domElement.getBoundingClientRect();
  return {
    x: rect.left + ((ndc.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - ndc.y) / 2) * rect.height,
  };
}
