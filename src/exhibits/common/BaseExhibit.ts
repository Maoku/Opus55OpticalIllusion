import * as THREE from 'three';
import { ease, tweens, type Easing } from '../../core/tween';
import type { ExhibitId } from '../../content/types';
import type { Exhibit, ExhibitContext, ViewMode } from '../types';

/**
 * 展示の共通実装。サブクラスは build() で 3D を組み立て、demo() で種明かしを演出する。
 * デモは AbortSignal で中断でき、終了・中断のあとは resetDemo() で元の状態に戻す。
 */
export abstract class BaseExhibit implements Exhibit {
  abstract readonly id: ExhibitId;
  abstract readonly viewMode: ViewMode;
  readonly root = new THREE.Group();
  protected ctx!: ExhibitContext;
  private demoAbort: AbortController | null = null;

  async init(ctx: ExhibitContext): Promise<void> {
    this.ctx = ctx;
    await this.build(ctx);
  }

  protected abstract build(ctx: ExhibitContext): void | Promise<void>;

  /** 種明かしの演出。最後まで再生したら true */
  protected demo?(signal: AbortSignal): Promise<boolean>;

  /** デモで変えた状態を元に戻す */
  protected resetDemo(): void {}

  async playDemo(): Promise<boolean> {
    this.stopDemo();
    if (!this.demo) return true;
    const ac = new AbortController();
    this.demoAbort = ac;
    const completed = await this.demo(ac.signal);
    if (this.demoAbort === ac) {
      this.demoAbort = null;
      this.resetDemo();
    }
    return completed && !ac.signal.aborted;
  }

  stopDemo(): void {
    if (!this.demoAbort) return;
    this.demoAbort.abort();
    this.demoAbort = null;
    this.resetDemo();
  }

  get demoPlaying(): boolean {
    return this.demoAbort !== null;
  }

  /** 演出用のトゥイーン。「動きを減らす」設定では一瞬で終える */
  protected animate(
    duration: number,
    onUpdate: (t: number) => void,
    signal: AbortSignal,
    easing: Easing = ease.inOutCubic,
  ): Promise<boolean> {
    return tweens.run(this.ctx.reducedMotion ? 0 : duration, onUpdate, { signal, ease: easing });
  }

  protected wait(seconds: number, signal: AbortSignal): Promise<boolean> {
    return tweens.wait(seconds, signal);
  }

  dispose(): void {
    this.stopDemo();
    disposeObject(this.root);
  }
}

/** Object3D 以下のジオメトリ・マテリアル・テクスチャを破棄する（共有物は除く） */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m || m.userData.shared) continue;
      const map = (m as THREE.MeshBasicMaterial).map;
      if (map && !mesh.userData.sharedMap) map.dispose();
      m.dispose();
    }
  });
}
