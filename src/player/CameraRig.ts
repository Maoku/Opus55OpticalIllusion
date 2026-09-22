import * as THREE from 'three';
import { ease, tweens } from '../core/tween';
import type { PlayerController } from './PlayerController';

/** 世界座標のカメラ姿勢 */
export interface WorldPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  /** 経由点（回り込む演出用） */
  via?: THREE.Vector3;
}

export interface Insets {
  right: number;
  bottom: number;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * カメラの姿勢を決める。
 * - follow: プレイヤーの目の位置と向きに追従する（歩行モード）
 * - hold: 指定した姿勢に留まる（鑑賞モード・デモ演出）。横ずらしに対応する
 *
 * 作品パネルが画面の一部を覆うときは、setViewOffset で投影の中心を空いている領域の中央へ移す。
 * 投影の中心（目の位置）は変わらないので、視点に依存する錯視は崩れない。
 */
export class CameraRig {
  mode: 'follow' | 'hold' = 'follow';
  /** 鑑賞モードの基準姿勢 */
  private base: WorldPose | null = null;
  private readonly current = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  private maxShift = 0;
  private shift = 0;
  private insets: Insets = { right: 0, bottom: 0 };
  private viewport = { width: 1, height: 1 };
  private flight: AbortController | null = null;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly player: PlayerController,
    private readonly getFov: () => number,
    private readonly getReducedMotion: () => boolean,
    private readonly fadeEl: HTMLElement | null,
  ) {}

  setViewport(width: number, height: number): void {
    this.viewport = { width, height };
    this.applyProjection();
  }

  setInsets(insets: Insets): void {
    this.insets = insets;
    this.applyProjection();
  }

  getInsets(): Insets {
    return { ...this.insets };
  }

  getViewport(): { width: number; height: number } {
    return { ...this.viewport };
  }

  private applyProjection(): void {
    const { width: w, height: h } = this.viewport;
    const { right, bottom } = this.insets;
    const fullW = w + right;
    const fullH = h + bottom;
    this.camera.aspect = fullW / fullH;
    if (right > 0 || bottom > 0) this.camera.setViewOffset(fullW, fullH, right, bottom, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  /** 画面上で 1 ラジアンが何 px になるか（投影の焦点距離） */
  focalPx(fov = this.camera.fov): number {
    const fullH = this.viewport.height + this.insets.bottom;
    return fullH / 2 / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  }

  follow(): void {
    this.cancelFlight();
    this.mode = 'follow';
    this.base = null;
    this.maxShift = 0;
    this.shift = 0;
  }

  /** 鑑賞の基準姿勢を設定する（allowShift があれば左右にずらせる） */
  setBase(pose: WorldPose, maxShift = 0): void {
    this.base = { position: pose.position.clone(), target: pose.target.clone(), fov: pose.fov };
    this.maxShift = maxShift;
    this.shift = 0;
  }

  get canShift(): boolean {
    return this.mode === 'hold' && !this.flight && this.maxShift > 0;
  }

  /** 横ずらし（m 単位の変化量） */
  addShift(delta: number): void {
    if (!this.canShift || !this.base) return;
    this.shift = THREE.MathUtils.clamp(this.shift + delta, -this.maxShift, this.maxShift);
    this.applyHold(this.shiftedPose(this.base));
  }

  getShift(): number {
    return this.shift;
  }

  private shiftedPose(base: WorldPose): WorldPose {
    if (this.shift === 0) return base;
    const dir = base.target.clone().sub(base.position);
    const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
    return {
      position: base.position.clone().addScaledVector(right, this.shift),
      target: base.target.clone(),
      fov: base.fov,
    };
  }

  /** 現在の姿勢（位置と注視点） */
  currentPose(targetDistance = 5): WorldPose {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return {
      position: this.camera.position.clone(),
      target: this.camera.position.clone().addScaledVector(dir, targetDistance),
      fov: this.camera.fov,
    };
  }

  playerPose(): WorldPose {
    const q = this.player.quaternion();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    return {
      position: this.player.position.clone(),
      target: this.player.position.clone().addScaledVector(dir, 5),
      fov: this.getFov(),
    };
  }

  /**
   * 姿勢を動かす。中断されると false。
   * style が 'fade' のとき、または「動きを減らす」設定のときはフェードで切り替える
   */
  async flyTo(
    to: WorldPose,
    duration: number,
    signal?: AbortSignal,
    style: 'auto' | 'fade' = 'auto',
  ): Promise<boolean> {
    this.cancelFlight();
    const ac = new AbortController();
    this.flight = ac;
    const onAbort = () => ac.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    this.mode = 'hold';

    const dist = Math.max(0.5, to.target.distanceTo(to.position));
    const from = this.currentPose(dist);
    let ok: boolean;
    if (duration <= 0) {
      this.applyHold(to);
      ok = true;
    } else if (style === 'fade' || this.getReducedMotion()) {
      ok = await this.fade(1, 0.18, ac.signal);
      if (ok) this.applyHold(to);
      ok = ok && (await this.fade(0, 0.22, ac.signal));
      if (!ok) this.setFade(0);
    } else {
      const p = new THREE.Vector3();
      const t = new THREE.Vector3();
      ok = await tweens.run(
        duration,
        (k) => {
          if (to.via) {
            // 2 次ベジェ曲線
            const a = 1 - k;
            p.copy(from.position)
              .multiplyScalar(a * a)
              .addScaledVector(to.via, 2 * a * k)
              .addScaledVector(to.position, k * k);
          } else {
            p.lerpVectors(from.position, to.position, k);
          }
          t.lerpVectors(from.target, to.target, k);
          this.applyHold({
            position: p,
            target: t,
            fov: THREE.MathUtils.lerp(from.fov, to.fov, k),
          });
        },
        { signal: ac.signal, ease: ease.inOutCubic },
      );
    }
    signal?.removeEventListener('abort', onAbort);
    if (this.flight === ac) this.flight = null;
    return ok;
  }

  /** 鑑賞の基準姿勢へ戻す */
  returnToBase(duration: number, signal?: AbortSignal): Promise<boolean> {
    if (!this.base) return Promise.resolve(true);
    return this.flyTo(this.shiftedPose(this.base), duration, signal);
  }

  cancelFlight(): void {
    this.flight?.abort();
    this.flight = null;
  }

  private applyHold(pose: WorldPose): void {
    this.current.position.copy(pose.position);
    this.current.target.copy(pose.target);
    this.camera.position.copy(pose.position);
    this.camera.up.copy(UP);
    this.camera.lookAt(pose.target);
    if (Math.abs(this.camera.fov - pose.fov) > 1e-4) {
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  private setFade(v: number): void {
    if (this.fadeEl) this.fadeEl.style.opacity = String(v);
  }

  private fade(to: number, duration: number, signal: AbortSignal): Promise<boolean> {
    const from = Number(this.fadeEl?.style.opacity || 0);
    return tweens.run(duration, (k) => this.setFade(from + (to - from) * k), {
      signal,
      ease: ease.linear,
    });
  }

  /** 毎フレーム: follow のときはプレイヤーの目に追従する */
  update(): void {
    if (this.mode !== 'follow') return;
    this.camera.position.copy(this.player.position);
    this.player.quaternion(this.camera.quaternion);
    const fov = this.getFov();
    if (Math.abs(this.camera.fov - fov) > 1e-4) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
