import * as THREE from 'three';
import { Store, createInitialState, DEFAULT_SETTINGS, type HintStage, type Quality } from './store';
import { applyQuality, createRenderer, detectQuality, QUALITY_PRESETS } from '../core/renderer';
import { InputManager } from '../core/input';
import { Loop } from '../core/loop';
import { tweens } from '../core/tween';
import { CollisionWorld } from '../world/collision';
import { buildMuseum, type Museum } from '../world/buildMuseum';
import { createExterior, createLighting, type LightingRig } from '../world/lighting';
import { ROOMS, SPAWN, bounds, roomAt } from '../world/layout';
import { PlayerController } from '../player/PlayerController';
import { CameraRig, type WorldPose } from '../player/CameraRig';
import { ExhibitManager, type ExhibitEntry } from '../exhibits/ExhibitManager';
import type { ExhibitContext } from '../exhibits/types';
import type { ViewportSpec } from '../exhibits/viewPose';
import { isExhibitId, type ExhibitId } from '../content/types';
import { LoadingScreen } from '../ui/LoadingScreen';
import { StartScreen } from '../ui/StartScreen';
import { PauseScreen } from '../ui/PauseScreen';
import { Hud } from '../ui/Hud';
import { ExhibitPanel } from '../ui/ExhibitPanel';

function parseQuality(value: string | null): Quality | null {
  return value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

/** 描画が 1 フレーム進むのを待つ（ローディング表示を更新するため） */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** 作品パネルが覆う領域（px）。CSS の .panel と一致させる */
export function panelInsets(width: number, height: number): { right: number; bottom: number } {
  return width > 720 ? { right: 392, bottom: 0 } : { right: 0, bottom: Math.round(height * 0.45) };
}

/** 鑑賞に入るときのカメラ移動の時間（秒） */
const VIEW_TRANSITION = 0.8;
/** これより遠い作品へ移るときは、飛ぶのではなくフェードで切り替える（m） */
const FLY_LIMIT = 12;
/** 横ずらしの速さ（m/s） */
const SHIFT_SPEED = 0.9;

export class App {
  readonly store: Store;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly input: InputManager;
  readonly collision = new CollisionWorld();
  readonly player: PlayerController;
  readonly rig: CameraRig;
  readonly exhibits: ExhibitManager;
  private readonly loop: Loop;
  private readonly uiRoot: HTMLElement;
  private readonly fadeEl: HTMLElement;
  private museum: Museum | null = null;
  private lighting: LightingRig | null = null;
  /** ポインタロックが使えない環境（タッチ端末・拒否された場合）ではドラッグで見回す */
  private pointerLockUsable = true;
  /** 鑑賞の開始・終了の処理中（連打を防ぐ） */
  private transitioning = false;
  private readonly ndc = new THREE.Vector2();
  readonly params = new URLSearchParams(window.location.search);

  constructor(private readonly container: HTMLElement) {
    this.renderer = createRenderer(container);
    const forced = parseQuality(this.params.get('quality'));
    const quality = forced ?? detectQuality(this.renderer);
    const settings = { ...DEFAULT_SETTINGS };
    if (forced) settings.quality = forced;
    settings.reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.store = new Store(createInitialState(settings, quality));
    applyQuality(this.renderer, quality);

    this.camera = new THREE.PerspectiveCamera(
      settings.fov,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.05,
      400,
    );
    this.scene.add(this.camera);

    this.input = new InputManager(this.renderer.domElement);
    this.player = new PlayerController(this.collision, this.input, () => this.store.get().settings);
    this.loop = new Loop(this.renderer, (dt, t) => this.frame(dt, t));

    this.pointerLockUsable =
      'requestPointerLock' in this.renderer.domElement &&
      !window.matchMedia?.('(pointer: coarse)').matches;

    this.uiRoot = document.createElement('div');
    this.uiRoot.id = 'ui';
    document.body.appendChild(this.uiRoot);
    this.fadeEl = document.createElement('div');
    this.fadeEl.className = 'fade';
    this.fadeEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.fadeEl);

    this.rig = new CameraRig(
      this.camera,
      this.player,
      () => this.store.get().settings.fov,
      () => this.store.get().settings.reducedMotion,
      this.fadeEl,
    );
    this.rig.setViewport(container.clientWidth, container.clientHeight);
    this.exhibits = new ExhibitManager(this.scene, this.collision, (e) => this.exhibitContext(e));

    this.createUi();
    this.bindEvents();
  }

  get fps(): number {
    return this.loop.fps;
  }

  get textureSize(): number {
    return QUALITY_PRESETS[this.store.get().quality].artTextureSize;
  }

  async init(): Promise<void> {
    const store = this.store;
    const preset = QUALITY_PRESETS[store.get().quality];
    const report = (p: number) => store.set({ loadingProgress: Math.min(0.99, p) });

    this.buildWorld();
    report(0.15);
    await nextFrame();
    this.buildLighting(preset.shadowMapSize);
    report(0.3);
    await nextFrame();
    // 中央ホールと Zone A を先に作る（§10）。残りは入館後に少しずつ作る
    await this.exhibits.loadZones(['entrance', 'plane'], (done, total) => {
      report(0.3 + (0.5 * done) / total);
    });
    await this.warmUp();
    report(0.95);

    this.player.teleport(SPAWN.x, SPAWN.z, SPAWN.yaw);
    this.updateZone();
    this.loop.start();

    const deepLink = this.params.get('exhibit');
    if (isExhibitId(deepLink) && this.exhibits.has(deepLink)) {
      store.set({ loadingProgress: 1, mode: 'walking' });
      await this.openExhibit(deepLink, { instant: true });
    } else {
      store.set({ loadingProgress: 1, mode: 'start' });
    }
    void this.exhibits.loadRemaining(async () => {
      await nextFrame();
      await nextFrame();
    });
  }

  // -------------------------------------------------------------------------
  // モード遷移
  // -------------------------------------------------------------------------

  /** 「入館する」 */
  enter(): void {
    this.store.set({ mode: 'walking' });
    this.lockPointer();
  }

  resume(): void {
    const s = this.store.get();
    this.store.set({ mode: s.resumeMode });
    if (s.resumeMode === 'walking') this.lockPointer();
  }

  pause(): void {
    const s = this.store.get();
    if (s.mode !== 'walking' && s.mode !== 'viewing') return;
    this.input.clearKeys();
    this.store.set({ mode: 'paused', resumeMode: s.mode });
  }

  viewportSpec(viewing = true): ViewportSpec {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    const inset = viewing ? panelInsets(w, h) : { right: 0, bottom: 0 };
    return { width: w, height: h, insetRight: inset.right, insetBottom: inset.bottom };
  }

  /** 作品の鑑賞モードを開く */
  async openExhibit(id: ExhibitId, opts: { instant?: boolean } = {}): Promise<void> {
    if (!this.exhibits.has(id) || this.transitioning) return;
    this.transitioning = true;
    try {
      const s = this.store.get();
      const prevId = s.activeExhibitId as ExhibitId | null;
      if (prevId) this.leaveExhibit(prevId);
      await this.exhibits.ensureReady(id);
      const entry = this.exhibits.get(id)!;

      this.input.exitPointerLock();
      this.input.clearKeys();
      const vp = this.viewportSpec(true);
      this.rig.setInsets({ right: vp.insetRight, bottom: vp.insetBottom });
      const pose = this.exhibits.viewPose(id, vp);
      const stand = this.exhibits.standPoint(id, vp);
      const far = this.camera.position.distanceTo(pose.position) > FLY_LIMIT;

      this.store.set({
        mode: 'viewing',
        resumeMode: 'viewing',
        activeExhibitId: id,
        nearbyExhibitId: null,
        hintStage: 'hidden',
        demoPlaying: false,
        visited: s.visited.includes(id) ? s.visited : [...s.visited, id],
      });
      this.player.teleport(stand.x, stand.z, stand.yaw);
      this.updateZone();
      entry.exhibit.onEnterView?.();

      const mode = entry.exhibit.viewMode;
      this.rig.setBase(pose, mode.kind === 'fixed' ? (mode.allowShift ?? 0) : 0);
      if (opts.instant) await this.rig.flyTo(pose, 0);
      else if (far) await this.fadeTo(pose);
      else await this.rig.flyTo(pose, VIEW_TRANSITION);
    } finally {
      this.transitioning = false;
    }
  }

  /** 遠い場所へはフェードで切り替える */
  private async fadeTo(pose: WorldPose): Promise<void> {
    await this.rig.flyTo(pose, 1, undefined, 'fade');
  }

  /** 作品の状態を戻す（デモの停止・ヒントの 3D 表現を消す） */
  private leaveExhibit(id: ExhibitId): void {
    const entry = this.exhibits.get(id);
    if (!entry) return;
    entry.exhibit.stopDemo?.();
    entry.exhibit.setHintVisible?.(false);
    entry.exhibit.onExitView?.();
  }

  /**
   * 鑑賞をやめて歩行に戻る。
   * toPaused: Esc で終えたときは再ロックできないので「クリックして再開」を表示する（§11）
   */
  async closeExhibit(opts: { toPaused?: boolean } = {}): Promise<void> {
    const id = this.store.get().activeExhibitId as ExhibitId | null;
    if (!id || this.transitioning) return;
    this.transitioning = true;
    try {
      this.leaveExhibit(id);
      const toPaused = !!opts.toPaused && this.pointerLockUsable;
      if (!toPaused) this.lockPointer();
      this.store.set({ hintStage: 'hidden', demoPlaying: false });
      this.rig.setInsets({ right: 0, bottom: 0 });
      await this.rig.flyTo(this.rig.playerPose(), 0.6);
      this.rig.follow();
      this.store.set({
        mode: toPaused ? 'paused' : 'walking',
        resumeMode: 'walking',
        activeExhibitId: null,
      });
    } finally {
      this.transitioning = false;
    }
  }

  async stepExhibit(dir: 1 | -1): Promise<void> {
    const id = this.store.get().activeExhibitId as ExhibitId | null;
    if (!id) return;
    const n = this.exhibits.neighbors(id);
    await this.openExhibit(dir > 0 ? n.next : n.prev);
  }

  setHintStage(stage: HintStage): void {
    const s = this.store.get();
    const id = s.activeExhibitId as ExhibitId | null;
    if (!id || s.mode !== 'viewing') return;
    const entry = this.exhibits.get(id)!;
    if (stage === 'hidden' && s.demoPlaying) this.stopDemo();
    entry.exhibit.setHintVisible?.(stage !== 'hidden');
    this.store.set({
      hintStage: stage,
      hintViewed:
        stage !== 'hidden' && !s.hintViewed.includes(id) ? [...s.hintViewed, id] : s.hintViewed,
    });
  }

  async playDemo(): Promise<void> {
    const s = this.store.get();
    const id = s.activeExhibitId as ExhibitId | null;
    if (!id || s.demoPlaying || s.hintStage === 'hidden') return;
    const exhibit = this.exhibits.get(id)!.exhibit;
    if (!exhibit.playDemo) return;
    this.store.set({ demoPlaying: true });
    await exhibit.playDemo();
    if (this.store.get().activeExhibitId === id && this.store.get().demoPlaying) {
      this.store.set({ demoPlaying: false });
      await this.rig.returnToBase(0.8);
    }
  }

  stopDemo(): void {
    const id = this.store.get().activeExhibitId as ExhibitId | null;
    if (!id) return;
    this.exhibits.get(id)!.exhibit.stopDemo?.();
    this.store.set({ demoPlaying: false });
    void this.rig.returnToBase(0.6);
  }

  toggleDemo(): void {
    if (this.store.get().demoPlaying) this.stopDemo();
    else void this.playDemo();
  }

  private lockPointer(): void {
    if (this.pointerLockUsable) this.input.requestPointerLock();
  }

  // -------------------------------------------------------------------------
  // UI とイベント
  // -------------------------------------------------------------------------

  private createUi(): void {
    const loading = new LoadingScreen(this.store);
    const start = new StartScreen(this.store, () => this.enter());
    const pause = new PauseScreen(this.store, {
      resume: () => this.resume(),
      openMap: () => undefined,
      openSettings: () => undefined,
    });
    const hud = new Hud(this.store, {
      viewNearby: () => {
        const near = this.store.get().nearbyExhibitId as ExhibitId | null;
        if (near) void this.openExhibit(near);
      },
    });
    const panel = new ExhibitPanel(
      this.store,
      {
        content: (id) => this.exhibits.get(id)!.content,
        hasDemo: (id) => {
          const e = this.exhibits.get(id);
          return !!e?.exhibit.playDemo && !!e.content.demoLabel;
        },
        actions: (id) => this.exhibits.get(id)?.exhibit.panelActions ?? [],
      },
      {
        close: () => void this.closeExhibit(),
        prev: () => void this.stepExhibit(-1),
        next: () => void this.stepExhibit(1),
        setHintStage: (stage) => this.setHintStage(stage),
        toggleDemo: () => this.toggleDemo(),
      },
    );
    this.uiRoot.append(hud.el, panel.el, pause.el, start.el, loading.el);
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('pointerlockchange', () => {
      if (!this.input.pointerLocked && this.store.get().mode === 'walking' && !this.transitioning) {
        this.pause();
      }
    });
    document.addEventListener('pointerlockerror', () => {
      // ロックできない環境ではドラッグ操作で歩行を続ける
      this.pointerLockUsable = false;
    });
    this.input.onClick((e) => this.onCanvasClick(e));
    this.input.onKey((e) => this.onKey(e));
  }

  private onKey(e: KeyboardEvent): void {
    const s = this.store.get();
    if (e.repeat) return;
    if (s.mode === 'walking') {
      if (e.code === 'KeyE' && s.nearbyExhibitId) {
        void this.openExhibit(s.nearbyExhibitId as ExhibitId);
      }
      return;
    }
    if (s.mode === 'viewing') {
      switch (e.code) {
        case 'Escape':
          void this.closeExhibit({ toPaused: true });
          break;
        case 'KeyQ':
          void this.closeExhibit();
          break;
        case 'KeyH':
          this.setHintStage(s.hintStage === 'hidden' ? 'appearance' : 'hidden');
          break;
        case 'ArrowLeft':
          void this.stepExhibit(-1);
          break;
        case 'ArrowRight':
          void this.stepExhibit(1);
          break;
      }
    }
  }

  private onCanvasClick(e: PointerEvent): void {
    const s = this.store.get();
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (this.input.pointerLocked) this.ndc.set(0, 0);
    else {
      this.ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
    }
    if (s.mode === 'walking') {
      const hit = this.exhibits.pick(this.ndc, this.camera);
      if (hit) {
        void this.openExhibit(hit);
        return;
      }
      if (!this.input.pointerLocked) this.lockPointer();
      return;
    }
    if (s.mode === 'viewing' && s.activeExhibitId) {
      this.exhibits.get(s.activeExhibitId as ExhibitId)?.exhibit.onViewClick?.({
        x: this.ndc.x,
        y: this.ndc.y,
      });
    }
  }

  private exhibitContext(entry: ExhibitEntry): ExhibitContext {
    const store = this.store;
    const rig = this.rig;
    const exhibits = this.exhibits;
    const camera = this.camera;
    const textureSize = () => this.textureSize;
    return {
      renderer: this.renderer,
      camera,
      scene: this.scene,
      get quality() {
        return store.get().quality;
      },
      get textureSize() {
        return textureSize();
      },
      get reducedMotion() {
        return store.get().settings.reducedMotion;
      },
      rig: {
        flyTo: (shot, duration = 1.4, signal) =>
          rig.flyTo(exhibits.shotToWorld(entry.id, shot, camera.fov), duration, signal),
        returnToView: (duration = 1.0, signal) => rig.returnToBase(duration, signal),
      },
    };
  }

  // -------------------------------------------------------------------------
  // 建築とループ
  // -------------------------------------------------------------------------

  private buildWorld(): void {
    this.museum = buildMuseum(1024);
    this.scene.add(this.museum.group);
    this.collision.add(...this.museum.colliders);
    this.scene.add(createExterior());
  }

  private buildLighting(shadowMapSize: number): void {
    this.lighting = createLighting(this.renderer, this.scene, bounds(ROOMS), shadowMapSize);
    this.scene.add(this.lighting.group);
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** シェーダのコンパイルと影の生成を先に済ませる */
  private async warmUp(): Promise<void> {
    this.player.teleport(SPAWN.x, SPAWN.z, SPAWN.yaw);
    this.rig.update();
    await this.renderer.compileAsync(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.rig.setViewport(w, h);
    const s = this.store.get();
    if (s.mode === 'viewing' && s.activeExhibitId && !s.demoPlaying) {
      const vp = this.viewportSpec(true);
      this.rig.setInsets({ right: vp.insetRight, bottom: vp.insetBottom });
      const id = s.activeExhibitId as ExhibitId;
      const mode = this.exhibits.get(id)!.exhibit.viewMode;
      const pose = this.exhibits.viewPose(id, vp);
      this.rig.setBase(pose, mode.kind === 'fixed' ? (mode.allowShift ?? 0) : 0);
      void this.rig.flyTo(pose, 0);
    }
  }

  private updateZone(): void {
    const room = roomAt(this.player.position.x, this.player.position.z);
    if (room) this.store.set({ zoneId: room.zone });
  }

  private frame(dt: number, _time: number): void {
    const s = this.store.get();
    const walking = s.mode === 'walking';
    const viewing = s.mode === 'viewing';
    tweens.update(dt);

    // 歩行中はドラッグで見回し、鑑賞中はドラッグで横ずらしする
    this.input.dragLookEnabled =
      (walking && (!this.pointerLockUsable || !this.input.pointerLocked)) ||
      (viewing && this.rig.canShift);
    if (viewing && this.rig.canShift) {
      const look = this.input.consumeLook();
      let delta = look.dx * 0.004;
      if (this.input.isDown('KeyA')) delta -= SHIFT_SPEED * dt;
      if (this.input.isDown('KeyD')) delta += SHIFT_SPEED * dt;
      if (delta !== 0) this.rig.addShift(delta);
    }

    this.player.update(dt, walking);
    this.rig.update();
    if (walking) {
      this.updateZone();
      const near = this.exhibits.findNearby(
        this.player.position,
        this.player.forward(),
        this.viewportSpec(true),
      );
      if (near !== s.nearbyExhibitId) this.store.set({ nearbyExhibitId: near });
    }
    this.exhibits.update(dt, this.player.position, s.activeExhibitId as ExhibitId | null);
    this.renderer.render(this.scene, this.camera);
  }
}
