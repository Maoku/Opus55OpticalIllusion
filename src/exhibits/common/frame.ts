import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { artMaterial } from './canvasTexture';

export interface FrameOptions {
  /** 作品面の幅・高さ（m） */
  width: number;
  height: number;
  /** 作品面の中心の高さ（m） */
  centerY?: number;
  /** 額縁の見付け幅（m） */
  border?: number;
  depth?: number;
  color?: number;
  /** 壁面の光だまり（スポットライトの効果）をつけるか */
  glow?: boolean;
}

export interface FramedArt {
  group: THREE.Group;
  /** 作品面（ローカル座標で z = depth の位置、+Z 向き） */
  art: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** 作品面の手前に重ねる演出用のレイヤ（ガイド線など） */
  overlay: THREE.Group;
  centerY: number;
  surfaceZ: number;
}

let glowTexture: THREE.CanvasTexture | null = null;

/** スポットライトが壁に作る光だまり。加算合成で壁を明るくする */
function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size * 0.42, 0, size / 2, size * 0.5, size / 2);
  g.addColorStop(0, 'rgba(255,244,225,0.26)');
  g.addColorStop(0.55, 'rgba(255,244,225,0.1)');
  g.addColorStop(1, 'rgba(255,244,225,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

export function createWallGlow(width: number, height: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: getGlowTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: true,
    }),
  );
  mesh.userData.sharedMap = true;
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * 壁掛けの額装作品。ローカル原点は壁面上の床の位置で、作品は +Z 方向を向く。
 */
export function createFramedArt(map: THREE.Texture | null, opts: FrameOptions): FramedArt {
  const { width, height } = opts;
  const centerY = opts.centerY ?? 1.55;
  const border = opts.border ?? 0.035;
  const depth = opts.depth ?? 0.045;
  const group = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({
    color: opts.color ?? 0x1d1d1f,
    roughness: 0.45,
    metalness: 0.4,
  });
  const W = width + border * 2;
  const H = height + border * 2;
  const bars = [
    [W, border, 0, (height + border) / 2],
    [W, border, 0, -(height + border) / 2],
    [border, height, -(width + border) / 2, 0],
    [border, height, (width + border) / 2, 0],
  ].map(([w, h, x, y]) => {
    const g = new THREE.BoxGeometry(w!, h!, depth);
    g.translate(x!, centerY + y!, depth / 2);
    return g;
  });
  // 裏板（作品面の背後）
  const back = new THREE.BoxGeometry(width, height, 0.01);
  back.translate(0, centerY, 0.005);
  const frameGeo = mergeGeometries([...bars, back]);
  for (const g of [...bars, back]) g.dispose();
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.name = 'frame';
  group.add(frame);

  const surfaceZ = depth - 0.008;
  const art = new THREE.Mesh(new THREE.PlaneGeometry(width, height), artMaterial(map));
  art.position.set(0, centerY, surfaceZ);
  art.name = 'art';
  group.add(art);

  const overlay = new THREE.Group();
  overlay.position.set(0, centerY, surfaceZ + 0.002);
  group.add(overlay);

  if (opts.glow !== false) {
    const glow = createWallGlow(W * 1.9, H * 1.7);
    glow.position.set(0, centerY + H * 0.12, 0.003);
    group.add(glow);
  }

  return { group, art, overlay, centerY, surfaceZ };
}

/** 台座（直方体）。上面の高さ top、ローカル原点は床 */
export function createPedestal(width: number, depthZ: number, top: number): THREE.Mesh {
  const g = new THREE.BoxGeometry(width, top, depthZ);
  g.translate(0, top / 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.85 }));
  m.castShadow = false;
  m.receiveShadow = true;
  m.name = 'pedestal';
  return m;
}
