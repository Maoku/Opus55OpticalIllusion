import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  CEILING_THICKNESS,
  FURNITURE,
  ROOMS,
  SIGNS,
  computeWalls,
  subtractRects,
  type FurnitureDef,
  type RoomDef,
  type SignDef,
  type WallPiece,
} from './layout';
import { getMaterials, type MuseumMaterials } from './materials';
import { rectCollider, type Collider } from './collision';

export interface Museum {
  group: THREE.Group;
  colliders: Collider[];
  dispose(): void;
}

/** 床のテクスチャ 1 枚が覆う大きさ（m） */
const FLOOR_TILE = 4;

type GeoBuckets = Map<keyof MuseumMaterials, THREE.BufferGeometry[]>;

function push(b: GeoBuckets, key: keyof MuseumMaterials, geo: THREE.BufferGeometry): void {
  const list = b.get(key) ?? [];
  list.push(geo);
  b.set(key, list);
}

function box(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/** 水平な面（床・天井）。UV は世界座標で振る */
function horizontalPlane(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  facingUp: boolean,
): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(facingUp ? -Math.PI / 2 : Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / FLOOR_TILE, -pos.getZ(i) / FLOOR_TILE);
  }
  return g;
}

function buildRoom(room: RoomDef, b: GeoBuckets): void {
  const r = room.rect;
  push(b, room.dark ? 'darkFloor' : 'floor', horizontalPlane(r.x0, r.z0, r.x1, r.z1, 0, true));

  // 天井（天窓の部分をくり抜く）
  const pieces = subtractRects(r, room.skylights ?? []);
  const h = room.height;
  for (const p of pieces) {
    push(
      b,
      room.dark ? 'darkWall' : 'ceiling',
      box(p.x0, h, p.z0, p.x1, h + CEILING_THICKNESS, p.z1),
    );
  }

  // 天窓: 光井戸の壁と、上端の明るいガラス面
  for (const s of room.skylights ?? []) {
    const well = 1.2;
    const t = 0.1;
    const y0 = h;
    const y1 = h + well;
    push(b, 'ceiling', box(s.x0 - t, y0, s.z0 - t, s.x1 + t, y1, s.z0));
    push(b, 'ceiling', box(s.x0 - t, y0, s.z1, s.x1 + t, y1, s.z1 + t));
    push(b, 'ceiling', box(s.x0 - t, y0, s.z0, s.x0, y1, s.z1));
    push(b, 'ceiling', box(s.x1, y0, s.z0, s.x1 + t, y1, s.z1));
    const glow = horizontalPlane(s.x0, s.z0, s.x1, s.z1, y1 - 0.02, false);
    push(b, 'skylight', glow);
    // 天窓の格子
    const step = 2;
    for (let x = s.x0 + step; x < s.x1 - 0.01; x += step) {
      push(b, 'steel', box(x - 0.04, y1 - 0.2, s.z0, x + 0.04, y1 - 0.03, s.z1));
    }
  }
}

function buildWall(piece: WallPiece, b: GeoBuckets, darkRooms: Set<string>): void {
  const { rect: r, y0, y1 } = piece;
  const dark = darkRooms.has(piece.roomId);
  if (piece.kind === 'glass') {
    const alongX = r.x1 - r.x0 > r.z1 - r.z0;
    const mid = alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2;
    const glass = alongX
      ? box(r.x0, 0, mid - 0.01, r.x1, y1, mid + 0.01)
      : box(mid - 0.01, 0, r.z0, mid + 0.01, y1, r.z1);
    push(b, 'glass', glass);
    // 方立て（スチールの枠）
    const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
    const n = Math.max(1, Math.round(len / 2.5));
    for (let i = 0; i <= n; i++) {
      const c = (alongX ? r.x0 : r.z0) + (len * i) / n;
      push(
        b,
        'steel',
        alongX
          ? box(c - 0.05, 0, mid - 0.08, c + 0.05, y1, mid + 0.08)
          : box(mid - 0.08, 0, c - 0.05, mid + 0.08, y1, c + 0.05),
      );
    }
    push(
      b,
      'steel',
      alongX
        ? box(r.x0, 0, mid - 0.1, r.x1, 0.08, mid + 0.1)
        : box(mid - 0.1, 0, r.z0, mid + 0.1, 0.08, r.z1),
    );
    push(
      b,
      'steel',
      alongX
        ? box(r.x0, y1 - 0.4, mid - 0.1, r.x1, y1, mid + 0.1)
        : box(mid - 0.1, y1 - 0.4, r.z0, mid + 0.1, y1, r.z1),
    );
    return;
  }

  if (piece.kind === 'wall' && !dark) {
    // 壁の下端の目地（シャドーギャップ）: 壁を 4cm 浮かせ、その下を濃い色で見せる
    const gap = 0.04;
    const inset = 0.015;
    const g =
      piece.side === 'north' || piece.side === 'south'
        ? box(
            r.x0,
            0,
            r.z0 + (piece.side === 'south' ? inset : 0),
            r.x1,
            gap,
            r.z1 - (piece.side === 'north' ? inset : 0),
          )
        : box(
            r.x0 + (piece.side === 'east' ? inset : 0),
            0,
            r.z0,
            r.x1 - (piece.side === 'west' ? inset : 0),
            gap,
            r.z1,
          );
    push(b, 'shadowGap', g);
    push(b, 'wall', box(r.x0, gap, r.z0, r.x1, y1, r.z1));
    return;
  }
  push(b, 'wall', box(r.x0, y0, r.z0, r.x1, y1, r.z1));
  if (dark && piece.kind !== 'corner') {
    // 暗室の内側だけに黒い内張りを貼る。壁の本体は白いまま（隣の部屋と共有する壁で色がちらつかない）
    const a = 0.004;
    const c = 0.014;
    const liner =
      piece.side === 'north'
        ? box(r.x0, y0, r.z1 + a, r.x1, y1, r.z1 + c)
        : piece.side === 'south'
          ? box(r.x0, y0, r.z0 - c, r.x1, y1, r.z0 - a)
          : piece.side === 'west'
            ? box(r.x1 + a, y0, r.z0, r.x1 + c, y1, r.z1)
            : box(r.x0 - c, y0, r.z0, r.x0 - a, y1, r.z1);
    push(b, 'darkWall', liner);
  }
}

function buildFurniture(f: FurnitureDef, b: GeoBuckets): Collider[] {
  const m = new THREE.Matrix4().makeRotationY(f.rotation).setPosition(f.x, 0, f.z);
  const parts: [keyof MuseumMaterials, THREE.BufferGeometry][] = [];
  let hw: number;
  let hd: number;
  if (f.kind === 'bench') {
    hw = 1.2;
    hd = 0.25;
    parts.push(['oak', box(-1.2, 0.4, -0.25, 1.2, 0.46, 0.25)]);
    parts.push(['steel', box(-1.05, 0, -0.22, -0.97, 0.4, 0.22)]);
    parts.push(['steel', box(0.97, 0, -0.22, 1.05, 0.4, 0.22)]);
  } else {
    hw = 1.8;
    hd = 0.45;
    parts.push(['wall', box(-1.8, 0, -0.45, 1.8, 1.05, 0.45)]);
    parts.push(['oak', box(-1.85, 1.05, -0.5, 1.85, 1.1, 0.5)]);
  }
  for (const [key, g] of parts) {
    g.applyMatrix4(m);
    push(b, key, g);
  }
  // 回転は 90° 刻みを想定して外接矩形で衝突させる
  const c = Math.abs(Math.cos(f.rotation));
  const s = Math.abs(Math.sin(f.rotation));
  const ex = hw * c + hd * s;
  const ez = hw * s + hd * c;
  return [rectCollider(f.x - ex, f.z - ez, f.x + ex, f.z + ez)];
}

function signTexture(sign: SignDef): THREE.CanvasTexture {
  const w = 2048;
  const h = Math.round((w / sign.width) * 1.1);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#2a2a2c';
  ctx.textBaseline = 'alphabetic';
  const titleSize = Math.round(h * 0.42);
  ctx.font = `600 ${titleSize}px "Hiragino Sans","Noto Sans JP","Yu Gothic UI",sans-serif`;
  let tw = ctx.measureText(sign.title).width;
  if (tw > w * 0.98) {
    ctx.font = `600 ${Math.round((titleSize * w * 0.98) / tw)}px "Hiragino Sans","Noto Sans JP","Yu Gothic UI",sans-serif`;
    tw = ctx.measureText(sign.title).width;
  }
  ctx.fillText(sign.title, (w - tw) / 2, h * 0.52);
  ctx.fillStyle = '#6a6a70';
  ctx.font = `500 ${Math.round(h * 0.16)}px "Helvetica Neue",Arial,sans-serif`;
  const sub = sign.subtitle.split('').join(String.fromCharCode(8202));
  const sw = ctx.measureText(sub).width;
  ctx.fillText(sub, (w - sw) / 2, h * 0.86);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function buildSign(sign: SignDef): THREE.Mesh {
  const tex = signTexture(sign);
  const aspect = tex.image.height / tex.image.width;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(sign.width, sign.width * aspect),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }),
  );
  mesh.position.set(sign.x, sign.y, sign.z);
  mesh.rotation.y = sign.rotation;
  mesh.name = `sign:${sign.subtitle}`;
  return mesh;
}

/** 天井のトラックライト（器具の見た目だけ） */
function buildTrackLights(rooms: RoomDef[], b: GeoBuckets): void {
  for (const room of rooms) {
    if (room.dark || room.zone === 'corridor' || room.id === 'darkroom-door') continue;
    const r = room.rect;
    const y = room.height;
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    if (w < 6 || d < 6) continue;
    // 長い辺に沿って 2 本のレール
    const alongX = w >= d;
    const inset = Math.min(alongX ? d : w, 12) * 0.25;
    const rails = alongX ? [r.z0 + inset, r.z1 - inset] : [r.x0 + inset, r.x1 - inset];
    for (const c of rails) {
      if (alongX) push(b, 'steel', box(r.x0 + 1, y - 0.05, c - 0.03, r.x1 - 1, y, c + 0.03));
      else push(b, 'steel', box(c - 0.03, y - 0.05, r.z0 + 1, c + 0.03, y, r.z1 - 1));
      const len = (alongX ? w : d) - 2;
      const n = Math.floor(len / 3);
      for (let i = 0; i <= n; i++) {
        const t = (alongX ? r.x0 : r.z0) + 1 + (len * i) / Math.max(1, n);
        const g = new THREE.CylinderGeometry(0.06, 0.07, 0.22, 10);
        g.rotateX(0.5 * (c < (alongX ? (r.z0 + r.z1) / 2 : (r.x0 + r.x1) / 2) ? -1 : 1));
        if (alongX) g.translate(t, y - 0.16, c);
        else g.translate(c, y - 0.16, t);
        push(b, 'steel', g);
      }
    }
  }
}

export function buildMuseum(textureSize: number): Museum {
  const materials = getMaterials(textureSize);
  const group = new THREE.Group();
  group.name = 'museum';
  const buckets: GeoBuckets = new Map();
  const colliders: Collider[] = [];

  for (const room of ROOMS) buildRoom(room, buckets);

  const darkRooms = new Set(ROOMS.filter((r) => r.dark).map((r) => r.id));
  for (const piece of computeWalls(ROOMS)) {
    buildWall(piece, buckets, darkRooms);
    // 床から立ち上がる壁（垂れ壁以外）は歩行の障害物
    if (piece.y0 < 0.5) {
      colliders.push(rectCollider(piece.rect.x0, piece.rect.z0, piece.rect.x1, piece.rect.z1));
    }
  }

  for (const f of FURNITURE) colliders.push(...buildFurniture(f, buckets));
  buildTrackLights(ROOMS, buckets);

  for (const [key, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, materials[key]);
    mesh.name = `museum:${key}`;
    const opaque = key !== 'glass' && key !== 'skylight';
    mesh.castShadow = opaque && key !== 'floor' && key !== 'darkFloor';
    mesh.receiveShadow = opaque;
    if (key === 'glass') mesh.renderOrder = 5;
    group.add(mesh);
  }

  for (const sign of SIGNS) group.add(buildSign(sign));

  group.traverse((o) => {
    o.matrixAutoUpdate = false;
    o.updateMatrix();
  });

  return {
    group,
    colliders,
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.Material & { map?: THREE.Texture | null };
          if (o.name.startsWith('sign:')) {
            m.map?.dispose();
            m.dispose();
          }
        }
      });
    },
  };
}
