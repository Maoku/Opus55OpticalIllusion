import * as THREE from 'three';

/** 決定的な疑似乱数（mulberry32） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D コンテキストを取得できません');
  return [canvas, ctx];
}

/** 磨いたコンクリートの床（4m 四方で 1 枚、目地入り） */
function concreteTexture(size: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size);
  const rand = mulberry32(7);
  ctx.fillStyle = '#9d9a95';
  ctx.fillRect(0, 0, size, size);

  // 大きなムラ
  for (let i = 0; i < 90; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = (0.05 + rand() * 0.25) * size;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = rand() > 0.5;
    g.addColorStop(0, light ? 'rgba(255,255,255,0.07)' : 'rgba(40,36,32,0.07)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  // 骨材の粒
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 14;
    d[i] = d[i]! + n;
    d[i + 1] = d[i + 1]! + n;
    d[i + 2] = d[i + 2]! + n;
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < size * 1.5; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(235,232,226,0.35)' : 'rgba(60,56,52,0.3)';
    const s = 1 + rand() * 2.2;
    ctx.fillRect(rand() * size, rand() * size, s, s);
  }
  // 目地（タイルの縁）
  ctx.strokeStyle = 'rgba(70,66,62,0.55)';
  ctx.lineWidth = Math.max(1.5, size / 512);
  ctx.strokeRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** オーク材の木目 */
function oakTexture(size: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size);
  const rand = mulberry32(11);
  ctx.fillStyle = '#b98a58';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const y = rand() * size;
    const amp = 2 + rand() * 6;
    ctx.strokeStyle = `rgba(${90 + rand() * 40},${55 + rand() * 25},${25 + rand() * 20},${0.12 + rand() * 0.2})`;
    ctx.lineWidth = 0.6 + rand() * 2;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const yy = y + Math.sin((x / size) * Math.PI * 2 * (1 + rand() * 0.02) + i) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export interface MuseumMaterials {
  wall: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  darkFloor: THREE.MeshStandardMaterial;
  darkWall: THREE.MeshStandardMaterial;
  shadowGap: THREE.MeshStandardMaterial;
  oak: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  skylight: THREE.MeshBasicMaterial;
  plate: THREE.MeshStandardMaterial;
}

let cached: MuseumMaterials | null = null;

/** 建築の共通マテリアル（全体で共有する） */
export function getMaterials(textureSize = 1024): MuseumMaterials {
  if (cached) return cached;
  const floorTex = concreteTexture(textureSize);
  cached = {
    wall: new THREE.MeshStandardMaterial({ color: 0xf2f0eb, roughness: 0.92, metalness: 0 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xf6f5f2, roughness: 0.95, metalness: 0 }),
    floor: new THREE.MeshStandardMaterial({
      map: floorTex,
      color: 0xffffff,
      roughness: 0.32,
      metalness: 0,
      envMapIntensity: 0.9,
    }),
    darkFloor: new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.8 }),
    darkWall: new THREE.MeshStandardMaterial({ color: 0x1e1e20, roughness: 0.95 }),
    shadowGap: new THREE.MeshStandardMaterial({ color: 0x2b2a28, roughness: 0.9 }),
    oak: new THREE.MeshStandardMaterial({ map: oakTexture(512), roughness: 0.55 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.4, metalness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xcfe3ea,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    skylight: new THREE.MeshBasicMaterial({ color: 0xeef6ff, toneMapped: false }),
    plate: new THREE.MeshStandardMaterial({ color: 0xfafaf8, roughness: 0.6 }),
  };
  return cached;
}
