import * as THREE from 'three';
import { Store, createInitialState, DEFAULT_SETTINGS, type Quality } from './store';
import { applyQuality, createRenderer, detectQuality, QUALITY_PRESETS } from '../core/renderer';
import { InputManager } from '../core/input';
import { Loop } from '../core/loop';
import { CollisionWorld } from '../world/collision';
import { buildMuseum, type Museum } from '../world/buildMuseum';
import { createExterior, createLighting, type LightingRig } from '../world/lighting';
import { ROOMS, SPAWN, bounds, roomAt } from '../world/layout';
import { PlayerController } from '../player/PlayerController';
import { LoadingScreen } from '../ui/LoadingScreen';
import { StartScreen } from '../ui/StartScreen';
import { PauseScreen } from '../ui/PauseScreen';
import { Hud } from '../ui/Hud';

function parseQuality(value: string | null): Quality | null {
  return value === 'low' || value === 'medium' || value === 'high' ? value : null;
}

/** 描画が 1 フレーム進むのを待つ（ローディング表示を更新するため） */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export class App {
  readonly store: Store;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly input: InputManager;
  readonly collision = new CollisionWorld();
  readonly player: PlayerController;
  private readonly loop: Loop;
  private readonly uiRoot: HTMLElement;
  private museum: Museum | null = null;
  private lighting: LightingRig | null = null;
  /** ポインタロックが使えない環境（タッチ端末・拒否された場合）ではドラッグで見回す */
  private pointerLockUsable = true;
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
    this.createUi();
    this.bindEvents();
  }

  get fps(): number {
    return this.loop.fps;
  }

  async init(): Promise<void> {
    const store = this.store;
    const preset = QUALITY_PRESETS[store.get().quality];
    const steps: [number, () => void | Promise<void>][] = [
      [0.15, () => this.buildWorld(preset.artTextureSize)],
      [0.35, () => this.buildLighting(preset.shadowMapSize)],
      [0.2, () => this.warmUp()],
    ];
    let progress = 0;
    for (const [weight, step] of steps) {
      await step();
      progress += weight;
      store.set({ loadingProgress: Math.min(0.99, progress / 0.7) });
      await nextFrame();
    }
    this.player.teleport(SPAWN.x, SPAWN.z, SPAWN.yaw);
    this.updateZone();
    store.set({ loadingProgress: 1, mode: 'start' });
    this.loop.start();
  }

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

  private lockPointer(): void {
    if (this.pointerLockUsable) this.input.requestPointerLock();
  }

  private createUi(): void {
    const loading = new LoadingScreen(this.store);
    const start = new StartScreen(this.store, () => this.enter());
    const pause = new PauseScreen(this.store, {
      resume: () => this.resume(),
      openMap: () => undefined,
      openSettings: () => undefined,
    });
    const hud = new Hud(this.store);
    this.uiRoot.append(hud.el, pause.el, start.el, loading.el);
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('pointerlockchange', () => {
      if (!this.input.pointerLocked && this.store.get().mode === 'walking') this.pause();
    });
    document.addEventListener('pointerlockerror', () => {
      // ロックできない環境ではドラッグ操作で歩行を続ける
      this.pointerLockUsable = false;
    });
    this.input.onClick(() => {
      if (this.store.get().mode === 'walking' && !this.input.pointerLocked) this.lockPointer();
    });
  }

  private buildWorld(textureSize: number): void {
    this.museum = buildMuseum(Math.min(textureSize, 1024));
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
    this.applyPlayerCamera();
    await this.renderer.compileAsync(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private applyPlayerCamera(): void {
    this.camera.position.copy(this.player.position);
    this.player.quaternion(this.camera.quaternion);
  }

  private updateZone(): void {
    const room = roomAt(this.player.position.x, this.player.position.z);
    if (room) this.store.set({ zoneId: room.zone });
  }

  private frame(dt: number, _time: number): void {
    const mode = this.store.get().mode;
    const walking = mode === 'walking';
    // ポインタロック中、またはロックが使えない環境ではドラッグで見回せる
    this.input.dragLookEnabled = walking && (!this.pointerLockUsable || !this.input.pointerLocked);
    this.player.update(dt, walking);
    if (walking || mode === 'start') {
      this.applyPlayerCamera();
      this.updateZone();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
