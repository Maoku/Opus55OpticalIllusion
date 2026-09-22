import type { App } from './App';
import type { AppState } from './store';

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
  };
  window.__OIM__ = api;
}
