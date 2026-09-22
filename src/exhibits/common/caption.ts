import * as THREE from 'three';
import type { ExhibitContent } from '../../content/types';
import { fitText } from './canvasTexture';

const PLATE_W = 0.3;
const PLATE_H = 0.2;

/**
 * 壁面・台座に置くキャプションプレート（番号・タイトル・英題・区分）。
 * 雰囲気づくり用で、ヒントは含めない（§7.2）。ローカル原点はプレートの中心、+Z 向き。
 */
export function createCaptionPlate(content: ExhibitContent): THREE.Group {
  const w = 600;
  const h = Math.round((w * PLATE_H) / PLATE_W);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fbfaf7';
  ctx.fillRect(0, 0, w, h);
  const pad = 36;
  ctx.fillStyle = '#6b6b70';
  ctx.textBaseline = 'alphabetic';
  fitText(ctx, content.number, pad, 70, w - pad * 2, 34, 700, '"Helvetica Neue",Arial,sans-serif');
  ctx.fillStyle = '#1c1c1e';
  fitText(ctx, content.title, pad, 150, w - pad * 2, 50, 700);
  ctx.fillStyle = '#4a4a4f';
  fitText(
    ctx,
    content.titleEn,
    pad,
    205,
    w - pad * 2,
    28,
    500,
    '"Helvetica Neue",Arial,sans-serif',
  );
  ctx.fillStyle = '#8a8a90';
  fitText(
    ctx,
    content.kind === 'original' ? 'オリジナル作品' : (content.credit ?? ''),
    pad,
    h - 44,
    w - pad * 2,
    24,
    500,
  );
  ctx.fillStyle = content.kind === 'original' ? '#c2410c' : '#1c1c1e';
  ctx.fillRect(pad, 92, 44, 5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  const group = new THREE.Group();
  group.name = 'caption';
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(PLATE_W + 0.01, PLATE_H + 0.01, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xe6e4df, roughness: 0.6 }),
  );
  plate.position.z = 0.004;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(PLATE_W, PLATE_H),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: true }),
  );
  face.position.z = 0.0085;
  group.add(plate, face);
  return group;
}

let markTexture: THREE.CanvasTexture | null = null;

function getMarkTexture(): THREE.CanvasTexture {
  if (markTexture) return markTexture;
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(28,28,30,0.85)';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(28,28,30,0.06)';
  ctx.fill();
  // 目のアイコン
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(s * 0.26, s * 0.4);
  ctx.quadraticCurveTo(s * 0.5, s * 0.2, s * 0.74, s * 0.4);
  ctx.quadraticCurveTo(s * 0.5, s * 0.6, s * 0.26, s * 0.4);
  ctx.stroke();
  ctx.fillStyle = 'rgba(28,28,30,0.85)';
  ctx.beginPath();
  ctx.arc(s / 2, s * 0.4, s * 0.065, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.font = '700 64px "Hiragino Sans","Noto Sans JP","Yu Gothic UI",sans-serif';
  ctx.fillText('ここから見る', s / 2, s * 0.72);
  ctx.font = '600 30px "Helvetica Neue",Arial,sans-serif';
  ctx.fillText('VIEW FROM HERE', s / 2, s * 0.82);
  markTexture = new THREE.CanvasTexture(c);
  markTexture.colorSpace = THREE.SRGBColorSpace;
  markTexture.anisotropy = 8;
  return markTexture;
}

/** 床の「ここから見る」マーク。ローカル原点は床、文字の上側が向き（-Z）を指す */
export function createFloorMark(diameter = 0.8): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(diameter / 2, 48),
    new THREE.MeshBasicMaterial({
      map: getMarkTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.003;
  mesh.name = 'floor-mark';
  mesh.userData.sharedMap = true;
  mesh.renderOrder = 1;
  return mesh;
}
