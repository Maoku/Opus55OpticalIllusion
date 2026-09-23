import * as THREE from 'three';
import type { ExhibitContent, ExhibitId, ExhibitZone } from '../content/types';
import { getContent } from '../content/exhibits.ja';
import { EXHIBIT_PLACEMENTS, type ExhibitPlacement } from '../world/layout';
import type { Collider, CollisionWorld } from '../world/collision';
import { rectCollider } from '../world/collision';
import type { WorldPose } from '../player/CameraRig';
import { REGISTRY } from './registry';
import type { CameraShot, Exhibit, ExhibitContext, Vec3 } from './types';
import { createCaptionPlate, createCaptionStand, createFloorMark } from './common/caption';
import { localViewPose, type ViewportSpec } from './viewPose';

/** 近くの展示とみなす距離（m） */
export const NEAR_DISTANCE = 3;
/** 展示のほうを向いているとみなす角度（度） */
const FACING_DEG = 55;
/** update を呼ぶ距離（m） */
const ACTIVE_DISTANCE = 16;
/** まだ初期化していない展示を、近づいたときに初期化し始める距離（m） */
const PRELOAD_DISTANCE = 26;
/** これより遠い展示は描画しない（壁の向こうの展示の描画コールを減らす、§10） */
const VISIBLE_DISTANCE = 34;

export interface ExhibitEntry {
  id: ExhibitId;
  content: ExhibitContent;
  placement: ExhibitPlacement;
  exhibit: Exhibit;
  /** 展示を世界座標に置くためのグループ */
  group: THREE.Group;
  state: 'idle' | 'loading' | 'ready';
  ready: Promise<void> | null;
  /** update を呼ぶ範囲にいるか */
  active: boolean;
  /** 注視点（世界座標） */
  focus: THREE.Vector3;
}

export type ContextFactory = (entry: ExhibitEntry) => ExhibitContext;

export class ExhibitManager {
  readonly entries: ExhibitEntry[] = [];
  private readonly byId = new Map<ExhibitId, ExhibitEntry>();
  readonly group = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    scene: THREE.Scene,
    collision: CollisionWorld,
    private readonly makeContext: ContextFactory,
  ) {
    this.group.name = 'exhibits';
    scene.add(this.group);
    for (const placement of EXHIBIT_PLACEMENTS) {
      const factory = REGISTRY[placement.id];
      if (!factory) continue;
      const exhibit = factory();
      const group = new THREE.Group();
      group.name = `exhibit:${placement.id}`;
      group.position.set(placement.x, 0, placement.z);
      group.rotation.y = placement.rotation;
      group.updateMatrixWorld(true);
      const mode = exhibit.viewMode;
      const target = mode.kind === 'fixed' ? mode.target : mode.center;
      const entry: ExhibitEntry = {
        id: placement.id,
        content: getContent(placement.id),
        placement,
        exhibit,
        group,
        state: 'idle',
        ready: null,
        active: false,
        focus: this.toWorld(group, target),
      };
      this.entries.push(entry);
      this.byId.set(entry.id, entry);
      this.group.add(group);
      for (const c of exhibit.colliders ?? []) collision.add(transformCollider(c, placement));
    }
  }

  get(id: ExhibitId): ExhibitEntry | undefined {
    return this.byId.get(id);
  }

  has(id: ExhibitId): boolean {
    return this.byId.has(id);
  }

  ids(): ExhibitId[] {
    return this.entries.map((e) => e.id);
  }

  /** 前後の作品（順路順、端は反対側へ回る） */
  neighbors(id: ExhibitId): { prev: ExhibitId; next: ExhibitId } {
    const i = this.entries.findIndex((e) => e.id === id);
    const n = this.entries.length;
    return { prev: this.entries[(i - 1 + n) % n]!.id, next: this.entries[(i + 1) % n]!.id };
  }

  ensureReady(id: ExhibitId): Promise<void> {
    const entry = this.byId.get(id);
    if (!entry) return Promise.reject(new Error(`未登録の展示です: ${id}`));
    if (!entry.ready) {
      entry.state = 'loading';
      entry.ready = (async () => {
        await entry.exhibit.init(this.contextFor(entry));
        entry.group.add(entry.exhibit.root);
        this.addDecorations(entry);
        entry.group.updateMatrixWorld(true);
        entry.state = 'ready';
      })();
    }
    return entry.ready;
  }

  /** 指定ゾーンの展示を初期化する（ローディング中に使う） */
  async loadZones(zones: ExhibitZone[], onProgress?: (done: number, total: number) => void) {
    const targets = this.entries.filter((e) => zones.includes(e.content.zone));
    let done = 0;
    for (const e of targets) {
      await this.ensureReady(e.id);
      onProgress?.(++done, targets.length);
    }
  }

  /** 残りの展示を 1 つずつ初期化する（入館後、描画の合間に進める） */
  async loadRemaining(yieldFn: () => Promise<void>): Promise<void> {
    for (const e of this.entries) {
      if (e.state !== 'idle') continue;
      await yieldFn();
      await this.ensureReady(e.id);
    }
  }

  get readyCount(): number {
    return this.entries.filter((e) => e.state === 'ready').length;
  }

  /** 鑑賞モードの推奨視点（世界座標） */
  viewPose(id: ExhibitId, vp: ViewportSpec): WorldPose {
    const entry = this.byId.get(id)!;
    const local = localViewPose(entry.exhibit.viewMode, vp);
    return {
      position: this.toWorld(entry.group, local.position),
      target: this.toWorld(entry.group, local.target),
      fov: local.fov,
    };
  }

  /** 展示ローカル座標のカメラ演出を世界座標に直す */
  shotToWorld(id: ExhibitId, shot: CameraShot, fallbackFov: number): WorldPose {
    const entry = this.byId.get(id)!;
    return {
      position: this.toWorld(entry.group, shot.position),
      target: this.toWorld(entry.group, shot.target),
      fov: shot.fov ?? fallbackFov,
      via: shot.via ? this.toWorld(entry.group, shot.via) : undefined,
    };
  }

  /** 鑑賞したあとにプレイヤーが立つ位置と向き */
  standPoint(id: ExhibitId, vp: ViewportSpec): { x: number; z: number; yaw: number } {
    const entry = this.byId.get(id)!;
    const pose = this.viewPose(id, vp);
    const p = pose.position.clone();
    if (entry.exhibit.viewMode.kind === 'front') {
      // 作品から近すぎず遠すぎない位置に立つ
      const dir = p.clone().sub(pose.target).setY(0);
      const d = THREE.MathUtils.clamp(dir.length(), 1.4, 3.2);
      dir.normalize().multiplyScalar(d);
      p.copy(pose.target).add(dir);
    }
    const dx = pose.target.x - p.x;
    const dz = pose.target.z - p.z;
    return { x: p.x, z: p.z, yaw: Math.atan2(-dx, -dz) };
  }

  /** 歩行中に近くにあって、そちらを向いている展示 */
  findNearby(pos: THREE.Vector3, forward: THREE.Vector3, vp: ViewportSpec): ExhibitId | null {
    let best: ExhibitId | null = null;
    let bestScore = Infinity;
    const cosLimit = Math.cos(THREE.MathUtils.degToRad(FACING_DEG));
    for (const e of this.entries) {
      const dxF = e.focus.x - pos.x;
      const dzF = e.focus.z - pos.z;
      const dFocus = Math.hypot(dxF, dzF);
      const stand = this.standPoint(e.id, vp);
      const dStand = Math.hypot(stand.x - pos.x, stand.z - pos.z);
      const d = Math.min(dFocus, dStand);
      if (d > NEAR_DISTANCE) continue;
      const facing = dFocus < 1e-3 ? 1 : (dxF * forward.x + dzF * forward.z) / dFocus;
      if (facing < cosLimit) continue;
      const score = d * (2 - facing);
      if (score < bestScore) {
        bestScore = score;
        best = e.id;
      }
    }
    return best;
  }

  /** 画面上の点（正規化デバイス座標）にある展示 */
  pick(ndc: THREE.Vector2, camera: THREE.Camera, maxDistance = 9): ExhibitId | null {
    this.raycaster.setFromCamera(ndc, camera);
    this.raycaster.far = maxDistance;
    const groups = this.entries.filter((e) => e.state === 'ready').map((e) => e.group);
    const hit = this.raycaster.intersectObjects(groups, true)[0];
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object;
    while (o && !o.name.startsWith('exhibit:')) o = o.parent;
    return o ? (o.name.slice('exhibit:'.length) as ExhibitId) : null;
  }

  update(dt: number, playerPos: THREE.Vector3, activeId: ExhibitId | null): void {
    for (const e of this.entries) {
      const d = Math.hypot(e.focus.x - playerPos.x, e.focus.z - playerPos.z);
      if (e.state === 'idle' && d < PRELOAD_DISTANCE) void this.ensureReady(e.id);
      if (e.state !== 'ready') continue;
      e.group.visible = e.id === activeId || d < VISIBLE_DISTANCE;
      const active = e.id === activeId || d < ACTIVE_DISTANCE;
      if (active !== e.active) {
        e.active = active;
        e.exhibit.setActive?.(active);
      }
      if (active) e.exhibit.update?.(dt, this.contextFor(e));
    }
  }

  private readonly contexts = new Map<ExhibitId, ExhibitContext>();

  contextFor(e: ExhibitEntry): ExhibitContext {
    let ctx = this.contexts.get(e.id);
    if (!ctx) {
      ctx = this.makeContext(e);
      this.contexts.set(e.id, ctx);
    }
    return ctx;
  }

  private addDecorations(entry: ExhibitEntry): void {
    const { exhibit, content, group } = entry;
    const mode = exhibit.viewMode;
    const anchor =
      exhibit.captionAnchor === undefined
        ? mode.kind === 'front'
          ? { position: [mode.width / 2 + 0.42, 1.3, 0.005] as Vec3, rotationY: 0 }
          : null
        : exhibit.captionAnchor;
    if (anchor) {
      const plate = createCaptionPlate(content);
      plate.position.set(...anchor.position);
      plate.rotation.y = anchor.rotationY ?? 0;
      group.add(plate);
      if ('stand' in anchor && anchor.stand)
        group.add(createCaptionStand(anchor.position, anchor.rotationY ?? 0));
    }
    const wantsMark = exhibit.floorMark ?? mode.kind === 'fixed';
    if (wantsMark && mode.kind === 'fixed') {
      const mark = createFloorMark();
      const holder = new THREE.Group();
      holder.position.set(mode.position[0], 0, mode.position[2]);
      holder.rotation.y = Math.atan2(
        -(mode.target[0] - mode.position[0]),
        -(mode.target[2] - mode.position[2]),
      );
      holder.add(mark);
      group.add(holder);
    }
  }

  private toWorld(group: THREE.Object3D, v: Vec3): THREE.Vector3 {
    group.updateMatrixWorld(true);
    return new THREE.Vector3(v[0], v[1], v[2]).applyMatrix4(group.matrixWorld);
  }

  dispose(): void {
    for (const e of this.entries) e.exhibit.dispose();
  }
}

/** 展示ローカル座標の障害物を世界座標に直す（回転は 90° 刻みを想定し、外接矩形にする） */
export function transformCollider(c: Collider, p: { x: number; z: number; rotation: number }) {
  const cos = Math.cos(p.rotation);
  const sin = Math.sin(p.rotation);
  const tx = (x: number, z: number) => ({ x: p.x + x * cos + z * sin, z: p.z - x * sin + z * cos });
  if (c.kind === 'circle') {
    const q = tx(c.x, c.z);
    return { kind: 'circle' as const, x: q.x, z: q.z, r: c.r };
  }
  const pts = [tx(c.x0, c.z0), tx(c.x1, c.z0), tx(c.x0, c.z1), tx(c.x1, c.z1)];
  return rectCollider(
    Math.min(...pts.map((q) => q.x)),
    Math.min(...pts.map((q) => q.z)),
    Math.max(...pts.map((q) => q.x)),
    Math.max(...pts.map((q) => q.z)),
  );
}
