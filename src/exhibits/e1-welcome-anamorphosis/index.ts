import * as THREE from 'three';
import { BaseExhibit } from '../common/BaseExhibit';
import { projectorMatrix, projectToCanvas } from '../common/ProjectorMaterial';
import type { ExhibitContext, Vec3, ViewMode } from '../types';
import {
  COLUMN,
  EYE,
  HALL_HEIGHT,
  LOOK_AT,
  OPENING,
  PANEL,
  PROJECTOR_ASPECT,
  PROJECTOR_FOV,
  VIEW_FOV,
  WALL_Z,
  floorHit,
} from './design';

const INK = '#1b2552';
const ACCENT = '#e0592a';

/** プロジェクタの画像（P から見た 1 枚の絵）。背景は透明 */
function paintLogo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cam: THREE.PerspectiveCamera,
) {
  const p = (x: number, y: number, z: number) => projectToCanvas(cam, { x, y, z }, w, h);
  ctx.clearRect(0, 0, w, h);

  // 目のシンボル
  const c = p(0, 5.3, WALL_Z);
  const ew = p(1.7, 5.3, WALL_Z).x - p(-1.7, 5.3, WALL_Z).x;
  const eh = ew * 0.42;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.lineWidth = ew * 0.045;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-ew / 2, 0);
  ctx.quadraticCurveTo(0, -eh, ew / 2, 0);
  ctx.quadraticCurveTo(0, eh, -ew / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const iris = ctx.createRadialGradient(-eh * 0.1, -eh * 0.1, eh * 0.05, 0, 0, eh * 0.46);
  iris.addColorStop(0, '#39b6c9');
  iris.addColorStop(1, '#1d4fa6');
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(0, 0, eh * 0.44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0c0f22';
  ctx.beginPath();
  ctx.arc(0, 0, eh * 0.19, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(eh * 0.12, -eh * 0.13, eh * 0.07, 0, Math.PI * 2);
  ctx.fill();
  // まつげの代わりの放射線
  ctx.strokeStyle = ACCENT;
  ctx.lineCap = 'round';
  ctx.lineWidth = ew * 0.03;
  for (let i = -3; i <= 3; i++) {
    const a = -Math.PI / 2 + i * 0.3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * eh * 0.78, Math.sin(a) * eh * 0.78 - eh * 0.1);
    ctx.lineTo(Math.cos(a) * eh * 1.02, Math.sin(a) * eh * 1.02 - eh * 0.12);
    ctx.stroke();
  }
  ctx.restore();

  // 館名
  const t = p(0, 2.15, WALL_Z);
  const tw = p(5.4, 2.15, WALL_Z).x - p(-5.4, 2.15, WALL_Z).x;
  const title = 'OPTICAL ILLUSION MUSEUM';
  let size = tw / 10;
  ctx.font = `800 ${size}px "Helvetica Neue",Arial,sans-serif`;
  const measured = ctx.measureText(title).width;
  size *= tw / measured;
  ctx.font = `800 ${size}px "Helvetica Neue",Arial,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.fillText(title, t.x, t.y);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(t.x - tw * 0.18, t.y + size * 0.62, tw * 0.36, size * 0.12);

  // 床の文字（P からだけ正しく読める）
  const zc = floorHit(-9.6);
  const f = p(0, 0, zc);
  const top = p(0, 0, floorHit(-8.1)).y;
  const bottom = p(0, 0, floorHit(-11.2)).y;
  const fs = (bottom - top) * 0.9;
  ctx.font = `800 ${fs}px "Hiragino Sans","Noto Sans JP","Yu Gothic UI",sans-serif`;
  ctx.fillStyle = ACCENT;
  ctx.fillText('錯視美術館へようこそ', f.x, f.y);
}

const vertexShader = /* glsl */ `
  uniform mat4 projector;
  varying vec4 vProj;
  varying vec3 vPos;
  void main() {
    vPos = position;
    vProj = projector * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 eye;
  uniform vec3 panelMin;
  uniform vec3 panelMax;
  uniform vec3 column;
  uniform float occlude;
  uniform float opacity;
  varying vec4 vProj;
  varying vec3 vPos;

  bool hitsPanel(vec3 p) {
    float t = (panelMin.z - eye.z) / (p.z - eye.z);
    if (t <= 0.0 || t >= 0.999) return false;
    vec3 q = eye + t * (p - eye);
    return q.x > panelMin.x && q.x < panelMax.x && q.y > panelMin.y && q.y < panelMax.y;
  }

  bool hitsColumn(vec3 p) {
    vec2 d = p.xz - eye.xz;
    vec2 oc = eye.xz - column.xy;
    float a = dot(d, d);
    float b = 2.0 * dot(oc, d);
    float c = dot(oc, oc) - column.z * column.z;
    float disc = b * b - 4.0 * a * c;
    if (disc < 0.0) return false;
    float t = (-b - sqrt(disc)) / (2.0 * a);
    return t > 0.0 && t < 0.999;
  }

  void main() {
    if (vProj.w <= 0.0) discard;
    vec2 uv = vProj.xy / vProj.w * 0.5 + 0.5;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) discard;
    if (occlude > 0.5 && (hitsPanel(vPos) || hitsColumn(vPos))) discard;
    vec4 c = texture2D(map, uv);
    if (c.a < 0.02) discard;
    gl_FragColor = vec4(c.rgb, c.a * opacity);
    #include <colorspace_fragment>
  }
`;

export class WelcomeAnamorphosisExhibit extends BaseExhibit {
  readonly id = 'welcome-anamorphosis' as const;
  readonly viewMode: ViewMode = {
    kind: 'fixed',
    position: [EYE.x, EYE.y, EYE.z],
    target: [LOOK_AT.x, LOOK_AT.y, LOOK_AT.z],
    fov: VIEW_FOV,
  };
  readonly colliders = [
    { kind: 'circle' as const, x: COLUMN.x, z: COLUMN.z, r: COLUMN.r },
    { kind: 'rect' as const, x0: PANEL.x0, z0: PANEL.z - 0.05, x1: PANEL.x1, z1: PANEL.z + 0.05 },
  ];
  readonly captionAnchor = { position: [1.2, 1.05, 5.6] as Vec3, stand: true };
  readonly debugPoints: Record<string, Vec3> = {
    /** 吊りパネルと、その陰になる壁の上の点（P からは同じ位置に見える） */
    panelCenter: [0, (PANEL.y0 + PANEL.y1) / 2, PANEL.z + 0.02],
  };
  private readonly materials: THREE.ShaderMaterial[] = [];

  protected build(ctx: ExhibitContext): void {
    const cam = new THREE.PerspectiveCamera(PROJECTOR_FOV, PROJECTOR_ASPECT, 0.1, 50);
    cam.position.set(EYE.x, EYE.y, EYE.z);
    cam.lookAt(LOOK_AT.x, LOOK_AT.y, LOOK_AT.z);
    const w = Math.min(2048, ctx.textureSize * 2);
    const h = Math.round(w / PROJECTOR_ASPECT);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    paintLogo(canvas.getContext('2d')!, w, h, cam);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
    const matrix = projectorMatrix(cam);

    const material = (occlude: boolean) => {
      const m = new THREE.ShaderMaterial({
        uniforms: {
          map: { value: tex },
          projector: { value: matrix },
          eye: { value: new THREE.Vector3(EYE.x, EYE.y, EYE.z) },
          panelMin: { value: new THREE.Vector3(PANEL.x0, PANEL.y0, PANEL.z) },
          panelMax: { value: new THREE.Vector3(PANEL.x1, PANEL.y1, PANEL.z) },
          column: { value: new THREE.Vector3(COLUMN.x, COLUMN.z, COLUMN.r) },
          occlude: { value: occlude ? 1 : 0 },
          opacity: { value: 1 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      this.materials.push(m);
      return m;
    };
    const wallMat = material(true);
    const frontMat = material(false);

    const plane = (w: number, h: number, pos: [number, number, number], rotX = 0) => {
      const g = new THREE.PlaneGeometry(w, h);
      if (rotX) g.rotateX(rotX);
      g.translate(...pos);
      return g;
    };
    const z = WALL_Z + 0.012;
    const H = HALL_HEIGHT - 0.05;
    const carriers = [
      plane(9.9 + OPENING.x0, H, [(-9.9 + OPENING.x0) / 2, H / 2 + 0.02, z]),
      plane(9.9 - OPENING.x1, H, [(9.9 + OPENING.x1) / 2, H / 2 + 0.02, z]),
      plane(OPENING.x1 - OPENING.x0, H - OPENING.top, [0, (H + OPENING.top) / 2, z]),
      plane(16, 10.5, [0, 0.004, -2.7], -Math.PI / 2),
    ];
    for (const g of carriers) {
      const m = new THREE.Mesh(g, wallMat);
      m.renderOrder = 2;
      m.name = 'e1-fragment';
      this.root.add(m);
    }

    // 吊りパネル
    const white = new THREE.MeshStandardMaterial({ color: 0xf6f5f1, roughness: 0.8 });
    const pw = PANEL.x1 - PANEL.x0;
    const ph = PANEL.y1 - PANEL.y0;
    const board = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.03), white);
    board.position.set((PANEL.x0 + PANEL.x1) / 2, (PANEL.y0 + PANEL.y1) / 2, PANEL.z);
    const face = new THREE.Mesh(
      plane(pw, ph, [(PANEL.x0 + PANEL.x1) / 2, (PANEL.y0 + PANEL.y1) / 2, PANEL.z + 0.016]),
      frontMat,
    );
    face.renderOrder = 2;
    const wireMat = new THREE.MeshStandardMaterial({
      color: 0x9a9a9a,
      metalness: 0.6,
      roughness: 0.4,
    });
    for (const x of [PANEL.x0 + 0.1, PANEL.x1 - 0.1]) {
      const wire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, HALL_HEIGHT - PANEL.y1, 6),
        wireMat,
      );
      wire.position.set(x, (HALL_HEIGHT + PANEL.y1) / 2, PANEL.z);
      this.root.add(wire);
    }
    this.root.add(board, face);

    // 柱
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(COLUMN.r, COLUMN.r, HALL_HEIGHT, 40),
      white,
    );
    column.position.set(COLUMN.x, HALL_HEIGHT / 2, COLUMN.z);
    const skinGeo = new THREE.CylinderGeometry(
      COLUMN.r + 0.004,
      COLUMN.r + 0.004,
      HALL_HEIGHT,
      64,
      1,
      true,
    );
    skinGeo.translate(COLUMN.x, HALL_HEIGHT / 2, COLUMN.z);
    const skin = new THREE.Mesh(skinGeo, frontMat);
    skin.renderOrder = 2;
    this.root.add(column, skin);
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    if (!(await this.wait(0.5, signal))) return false;
    const target: Vec3 = [LOOK_AT.x, LOOK_AT.y, LOOK_AT.z];
    if (!(await this.ctx.rig.flyTo({ position: [EYE.x + 3, EYE.y, EYE.z], target }, 2.6, signal)))
      return false;
    if (!(await this.wait(2.5, signal))) return false;
    if (
      !(await this.ctx.rig.flyTo(
        { position: [EYE.x - 2.5, EYE.y + 0.6, EYE.z - 1.5], target },
        2.6,
        signal,
      ))
    )
      return false;
    if (!(await this.wait(2, signal))) return false;
    return this.ctx.rig.returnToView(2.4, signal);
  }

  override dispose(): void {
    super.dispose();
    for (const m of this.materials) m.uniforms.map!.value.dispose();
  }
}
