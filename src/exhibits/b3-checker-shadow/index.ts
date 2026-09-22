import * as THREE from 'three';
import { BaseExhibit } from '../common/BaseExhibit';
import { createPedestal } from '../common/frame';
import { rectCollider } from '../../world/collision';
import type { ExhibitContext, Vec3, ViewMode } from '../types';
import {
  BOARD,
  CYLINDER,
  LIGHT_DIR,
  TARGET_GRAY,
  TILE,
  TILE_A,
  TILE_B,
  boardValue,
  tileCenter,
} from './board';

const PEDESTAL_TOP = 0.9;
const BOARD_THICK = 0.03;
const TOP = PEDESTAL_TOP + BOARD_THICK;

/** 円柱の陰影を頂点カラーに焼き込む（光源は右手前の上。影の向きと逆） */
function bakedCylinder(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(CYLINDER.radius, CYLINDER.radius, CYLINDER.height, 48, 1);
  const light = new THREE.Vector3(...LIGHT_DIR).normalize();
  const base = new THREE.Color(0x58a05a);
  const nor = g.getAttribute('normal');
  const colors = new Float32Array(nor.count * 3);
  const n = new THREE.Vector3();
  for (let i = 0; i < nor.count; i++) {
    n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
    const k = 0.32 + 0.68 * Math.max(0, n.dot(light));
    colors.set([base.r * k, base.g * k, base.b * k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.translate(CYLINDER.u, TOP + CYLINDER.height / 2, CYLINDER.v);
  return g;
}

function tileRect(t: { i: number; j: number }, s: number): [number, number, number, number] {
  const px = s / 5;
  return [t.i * px, t.j * px, px, px];
}

export class CheckerShadowExhibit extends BaseExhibit {
  readonly id = 'checker-shadow' as const;
  readonly viewMode: ViewMode = {
    kind: 'fixed',
    position: [0, 2.0, 1.55],
    target: [0, TOP, -0.05],
    fov: 36,
  };
  readonly colliders = [rectCollider(-0.6, -0.6, 0.6, 0.6)];
  readonly captionAnchor = { position: [0, 0.68, 0.606] as Vec3 };
  readonly debugPoints: Record<string, Vec3> = (() => {
    const a = tileCenter(TILE_A);
    const b = tileCenter(TILE_B);
    return { tileA: [a.u, TOP + 0.001, a.v], tileB: [b.u, TOP + 0.001, b.v] };
  })();

  private canvas: HTMLCanvasElement | null = null;
  private base: ImageData | null = null;
  private texture: THREE.CanvasTexture | null = null;
  private readonly cylinderMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  private band = 0;
  private dim = 0;

  protected build(ctx: ExhibitContext): void {
    this.root.add(createPedestal(1.2, 1.2, PEDESTAL_TOP));

    const size = Math.min(2048, ctx.textureSize);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const c2d = canvas.getContext('2d')!;
    const img = c2d.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      const v = ((y + 0.5) / size) * BOARD - BOARD / 2;
      for (let x = 0; x < size; x++) {
        const u = ((x + 0.5) / size) * BOARD - BOARD / 2;
        const g = boardValue(u, v);
        const k = (y * size + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = g;
        img.data[k + 3] = 255;
      }
    }
    c2d.putImageData(img, 0, 0);
    // 文字はタイルの中心を避けて、左上の隅に置く
    c2d.font = `800 ${Math.round(size * 0.05)}px "Helvetica Neue",Arial,sans-serif`;
    c2d.textBaseline = 'top';
    c2d.lineWidth = size * 0.006;
    for (const [label, t] of [
      ['A', TILE_A],
      ['B', TILE_B],
    ] as const) {
      const [x, y] = tileRect(t, size);
      c2d.strokeStyle = 'rgba(255,255,255,0.9)';
      c2d.strokeText(label, x + size * 0.012, y + size * 0.01);
      c2d.fillStyle = '#111111';
      c2d.fillText(label, x + size * 0.012, y + size * 0.01);
    }
    this.canvas = canvas;
    this.base = c2d.getImageData(0, 0, size, size);
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();

    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(BOARD, BOARD),
      new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }),
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = TOP;
    top.name = 'board';
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD, BOARD_THICK, BOARD),
      [0x6b6b6b, 0x6b6b6b, 0x9a9a9a, 0x9a9a9a, 0x505050, 0x505050].map(
        (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      ),
    );
    side.position.y = PEDESTAL_TOP + BOARD_THICK / 2 - 0.0005;
    const cyl = new THREE.Mesh(bakedCylinder(), this.cylinderMat);
    this.root.add(top, side, cyl);
  }

  /** デモの状態で盤面を描き直す */
  private repaint(): void {
    if (!this.canvas || !this.base || !this.texture) return;
    const c = this.canvas.getContext('2d')!;
    const s = this.canvas.width;
    c.putImageData(this.base, 0, 0);
    if (this.dim > 0) {
      c.save();
      c.beginPath();
      c.rect(0, 0, s, s);
      c.rect(...tileRect(TILE_A, s));
      c.rect(...tileRect(TILE_B, s));
      c.clip('evenodd');
      c.fillStyle = `rgba(0,0,0,${0.72 * this.dim})`;
      c.fillRect(0, 0, s, s);
      c.restore();
    }
    if (this.band > 0) {
      const a = tileCenter(TILE_A);
      const b = tileCenter(TILE_B);
      const toPx = (u: number) => ((u + BOARD / 2) / BOARD) * s;
      c.globalAlpha = this.band;
      c.strokeStyle = `rgb(${TARGET_GRAY},${TARGET_GRAY},${TARGET_GRAY})`;
      c.lineWidth = (TILE / BOARD) * s * 0.3;
      c.lineCap = 'butt';
      c.beginPath();
      c.moveTo(toPx(a.u), toPx(a.v));
      c.lineTo(toPx(b.u), toPx(b.v));
      c.stroke();
      c.globalAlpha = 1;
    }
    this.texture.needsUpdate = true;
    const k = 1 - 0.72 * this.dim;
    this.cylinderMat.color.setRGB(k, k, k);
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    const set = (band: number, dim: number) => {
      this.band = band;
      this.dim = dim;
      this.repaint();
    };
    if (!(await this.wait(0.5, signal))) return false;
    if (!(await this.animate(1.2, (t) => set(t, 0), signal))) return false;
    if (!(await this.wait(2.5, signal))) return false;
    if (!(await this.animate(1.2, (t) => set(1, t), signal))) return false;
    if (!(await this.wait(4, signal))) return false;
    return this.animate(1.2, (t) => set(1 - t, 1 - t), signal);
  }

  protected override resetDemo(): void {
    this.band = 0;
    this.dim = 0;
    this.repaint();
  }
}
