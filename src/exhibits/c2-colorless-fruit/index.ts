import * as THREE from 'three';
import { BaseExhibit } from '../common/BaseExhibit';
import { rectCollider } from '../../world/collision';
import { mulberry32 } from '../../world/materials';
import type { ExhibitContext, Vec3, ViewMode } from '../types';
import {
  ALBEDO,
  AMBIENT,
  CYAN_LIGHT,
  DIFFUSE,
  WHITE_LIGHT,
  isRedDominant,
  type AlbedoName,
} from './palette';

/** 小部屋の内法（展示ローカル座標。入口は +z 側） */
const ROOM = { x0: -2.9, x1: 2.9, z0: -2.2, z1: 3.4, height: 3.0 };
const TABLE_TOP = 0.76;

/** 部屋の外の照明の影響を受けない、独自の拡散照明（シアン光）のマテリアル */
const LIGHT_UNIFORMS = {
  lightColor: { value: new THREE.Color().setRGB(...CYAN_LIGHT) },
  lightDir: { value: new THREE.Vector3(-0.35, 0.85, 0.4).normalize() },
};
const LIGHT_DIR_LOCAL = new THREE.Vector3(-0.35, 0.85, 0.4).normalize();

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 albedo;
  uniform vec3 lightColor;
  uniform vec3 lightDir;
  uniform float ambient;
  uniform float diffuse;
  uniform float seeds;
  uniform vec3 seedAlbedo;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    float d = max(dot(n, lightDir), 0.0);
    vec3 a = albedo;
    if (seeds > 0.5) {
      // イチゴの種（互い違いの点）。種のアルベドも赤が優位にならない色にする
      vec2 g = vec2(vUv.x * 20.0, vUv.y * 8.0);
      vec2 f = fract(g + vec2(0.5 * floor(g.y), 0.0)) - 0.5;
      float m = smoothstep(0.2, 0.12, length(f * vec2(1.0, 1.5)));
      m *= step(0.1, vUv.y) * step(vUv.y, 0.88);
      a = mix(a, seedAlbedo, m);
    }
    vec3 c = a * lightColor * (ambient + diffuse * d);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

function tinted(name: AlbedoName, side: THREE.Side = THREE.FrontSide): THREE.ShaderMaterial {
  const a = ALBEDO[name];
  return new THREE.ShaderMaterial({
    uniforms: {
      albedo: { value: new THREE.Vector3(a[0], a[1], a[2]) },
      lightColor: LIGHT_UNIFORMS.lightColor,
      lightDir: LIGHT_UNIFORMS.lightDir,
      ambient: { value: AMBIENT },
      diffuse: { value: DIFFUSE },
      seeds: { value: name === 'strawberry' ? 1 : 0 },
      seedAlbedo: { value: new THREE.Vector3(...ALBEDO.seed) },
    },
    vertexShader,
    fragmentShader,
    toneMapped: false,
    side,
  });
}

function strawberry(): THREE.Group {
  const g = new THREE.Group();
  // 先端が細く、肩が丸いイチゴの輪郭（なめらかな曲線を回転させる）
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = 0.029 * Math.sin(Math.PI * Math.pow(t, 0.75)) * (0.55 + 0.45 * t);
    profile.push(new THREE.Vector2(Math.max(0.0005, r), 0.056 * t));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), tinted('strawberry'));
  const calyx = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.012, 7), tinted('calyx'));
  calyx.position.y = 0.056;
  g.add(body, calyx);
  return g;
}

function apple(r: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), tinted('apple'));
  body.scale.set(1, 0.9, 1);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 6), tinted('stem'));
  stem.position.y = r * 0.95;
  stem.rotation.z = 0.25;
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 6), tinted('calyx'));
  leaf.scale.set(1, 0.2, 0.5);
  leaf.position.set(0.012, r * 1.02, 0);
  g.add(body, stem, leaf);
  return g;
}

export class ColorlessFruitExhibit extends BaseExhibit {
  readonly id = 'colorless-fruit' as const;
  readonly viewMode: ViewMode = {
    kind: 'fixed',
    position: [0, 1.28, 1.2],
    target: [0.02, TABLE_TOP + 0.03, 0.02],
    fov: 36,
  };
  readonly colliders = [
    { kind: 'circle' as const, x: 0, z: 0, r: 0.6 },
    rectCollider(ROOM.x0 - 0.05, ROOM.z0, ROOM.x0, ROOM.z1),
    rectCollider(ROOM.x1, ROOM.z0, ROOM.x1 + 0.05, ROOM.z1),
    rectCollider(ROOM.x0, ROOM.z0 - 0.05, ROOM.x1, ROOM.z0),
  ];
  readonly captionAnchor = { position: [1.7, 1.05, 3.75] as Vec3, stand: true };
  private readonly lightDirWorld = new THREE.Vector3();

  protected build(_ctx: ExhibitContext): void {
    const add = (m: THREE.Object3D) => this.root.add(m);
    const box = (
      w: number,
      h: number,
      d: number,
      name: AlbedoName,
      x: number,
      y: number,
      z: number,
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tinted(name));
      m.position.set(x, y, z);
      add(m);
      return m;
    };
    const W = ROOM.x1 - ROOM.x0;
    const D = ROOM.z1 - ROOM.z0;
    const cz = (ROOM.z0 + ROOM.z1) / 2;
    // 床・壁・天井（内側から見る面）
    box(W, 0.02, D, 'floor', 0, -0.006, cz);
    box(W, 0.02, D, 'ceiling', 0, ROOM.height + 0.01, cz);
    box(W, ROOM.height, 0.04, 'wall', 0, ROOM.height / 2, ROOM.z0 - 0.02);
    box(0.04, ROOM.height, D, 'wall', ROOM.x0 - 0.02, ROOM.height / 2, cz);
    box(0.04, ROOM.height, D, 'wall', ROOM.x1 + 0.02, ROOM.height / 2, cz);
    // 腰壁
    box(W, 0.9, 0.01, 'wainscot', 0, 0.45, ROOM.z0 + 0.006);
    box(0.01, 0.9, D, 'wainscot', ROOM.x0 + 0.006, 0.45, cz);
    box(0.01, 0.9, D, 'wainscot', ROOM.x1 - 0.006, 0.45, cz);
    // 奥の壁の絵（抽象的な風景）
    box(1.3, 0.9, 0.03, 'frame', 0, 1.75, ROOM.z0 + 0.02);
    box(1.18, 0.4, 0.035, 'canvasBlue', 0, 1.95, ROOM.z0 + 0.02);
    box(1.18, 0.2, 0.035, 'canvasSand', 0, 1.65, ROOM.z0 + 0.02);
    box(1.18, 0.18, 0.035, 'canvasGreen', 0, 1.46, ROOM.z0 + 0.02);

    // テーブルとクロス
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 48), tinted('table'));
    top.position.y = TABLE_TOP - 0.02;
    const cloth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.62, 0.22, 48, 1, true),
      tinted('cloth', THREE.DoubleSide),
    );
    cloth.position.y = TABLE_TOP - 0.1;
    const clothTop = new THREE.Mesh(new THREE.CircleGeometry(0.56, 48), tinted('cloth'));
    clothTop.rotation.x = -Math.PI / 2;
    clothTop.position.y = TABLE_TOP + 0.001;
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, TABLE_TOP - 0.04, 16),
      tinted('table'),
    );
    leg.position.y = (TABLE_TOP - 0.04) / 2;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.03, 32), tinted('table'));
    foot.position.y = 0.015;
    add(top);
    add(cloth);
    add(clothTop);
    add(leg);
    add(foot);

    // 皿と果物
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.02, 40), tinted('plate'));
    plate.position.set(-0.08, TABLE_TOP + 0.011, 0.02);
    add(plate);
    const rand = mulberry32(3);
    const berries: [number, number, number][] = [
      [-0.16, 0.06, 0.4],
      [-0.08, 0.1, -0.3],
      [0.0, 0.05, 1.2],
      [-0.12, -0.04, 2.0],
      [-0.03, -0.03, -1.1],
      [0.04, -0.09, 0.7],
      [-0.18, -0.08, -0.6],
    ];
    for (const [x, z, rot] of berries) {
      // 横に寝かせ、先端を左右に向ける（輪郭がいちばんイチゴらしく見える向き）
      const holder = new THREE.Group();
      holder.position.set(x, TABLE_TOP + 0.036, z);
      holder.rotation.y = (rot > 0 ? 1 : -1) * (Math.PI / 2) + rot * 0.25;
      const s = strawberry();
      s.rotation.x = -Math.PI / 2 + 0.2;
      s.position.z = 0.035;
      s.scale.setScalar(1.25 + rand() * 0.25);
      holder.add(s);
      add(holder);
    }
    const a1 = apple(0.052);
    a1.position.set(0.22, TABLE_TOP + 0.047, -0.12);
    const a2 = apple(0.048);
    a2.position.set(0.3, TABLE_TOP + 0.043, 0.06);
    a2.rotation.y = 1.3;
    add(a1);
    add(a2);
    // ぶどう（緑）
    for (let i = 0; i < 16; i++) {
      const layer = Math.floor(i / 6);
      const a = (i % 6) * 1.05 + layer * 0.5;
      const gr = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), tinted('grape'));
      gr.position.set(
        0.08 + Math.cos(a) * (0.035 - layer * 0.01),
        TABLE_TOP + 0.02 + layer * 0.022,
        0.2 + Math.sin(a) * (0.03 - layer * 0.008) - layer * 0.01,
      );
      add(gr);
    }
    // さくらんぼ
    for (const [x, z] of [
      [0.14, 0.26],
      [0.18, 0.28],
    ] as const) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), tinted('cherry'));
      c.position.set(x, TABLE_TOP + 0.014, z);
      const st = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0015, 0.0015, 0.045, 5),
        tinted('stem'),
      );
      st.position.set(x + 0.008, TABLE_TOP + 0.036, z - 0.006);
      st.rotation.z = -0.4;
      add(c);
      add(st);
    }
  }

  update(): void {
    // 光の向きを展示のローカル座標から世界座標へ（配置の回転に合わせる）
    const q = new THREE.Quaternion();
    this.root.getWorldQuaternion(q);
    this.lightDirWorld.copy(LIGHT_DIR_LOCAL).applyQuaternion(q);
    LIGHT_UNIFORMS.lightDir.value.copy(this.lightDirWorld);
  }

  onEnterView(): void {
    this.update();
  }

  /** 画面のいまの画素を読む（描画してすぐ読むので、描画バッファの保持は不要） */
  private readFrame(): { data: Uint8Array; width: number; height: number } {
    const r = this.ctx.renderer;
    this.update();
    r.render(this.ctx.scene, this.ctx.camera);
    const gl = r.getContext();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const data = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return { data, width, height };
  }

  /** スポイト: クリックした点の実際の色を表示する */
  onViewClick(ndc: { x: number; y: number }): void {
    const f = this.readFrame();
    const x = Math.min(f.width - 1, Math.max(0, Math.floor(((ndc.x + 1) / 2) * f.width)));
    const y = Math.min(f.height - 1, Math.max(0, Math.floor(((ndc.y + 1) / 2) * f.height)));
    const k = (y * f.width + x) * 4;
    const [r, g, b] = [f.data[k]!, f.data[k + 1]!, f.data[k + 2]!];
    const red = isRedDominant([r, g, b], 6);
    this.ctx.notify(
      `スポイト: R ${r} / G ${g} / B ${b} — ${red ? '赤っぽい色です' : '赤ではありません（灰色〜青緑）'}`,
      `rgb(${r},${g},${b})`,
    );
  }

  /** 画面全体で赤が優位なピクセルの数 */
  countRedPixels(margin = 3): { red: number; total: number } {
    const f = this.readFrame();
    let red = 0;
    for (let i = 0; i < f.data.length; i += 4) {
      if (isRedDominant([f.data[i]!, f.data[i + 1]!, f.data[i + 2]!], margin)) red++;
    }
    return { red, total: f.width * f.height };
  }

  private setLight(t: number): void {
    const c = LIGHT_UNIFORMS.lightColor.value;
    c.setRGB(
      CYAN_LIGHT[0] + (WHITE_LIGHT[0] - CYAN_LIGHT[0]) * t,
      CYAN_LIGHT[1] + (WHITE_LIGHT[1] - CYAN_LIGHT[1]) * t,
      CYAN_LIGHT[2] + (WHITE_LIGHT[2] - CYAN_LIGHT[2]) * t,
    );
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    if (!(await this.wait(0.4, signal))) return false;
    const { red, total } = this.countRedPixels();
    this.ctx.notify(
      `画面を走査しました。赤いピクセル: ${red.toLocaleString()} 個（全 ${total.toLocaleString()} 画素）`,
    );
    if (!(await this.wait(3.5, signal))) return false;
    if (!(await this.animate(1.6, (t) => this.setLight(t), signal))) return false;
    const after = this.countRedPixels();
    this.ctx.notify(
      `照明を白にすると、果物は本当に赤い色です（赤いピクセル: ${after.red.toLocaleString()} 個）`,
    );
    if (!(await this.wait(4.5, signal))) return false;
    return this.animate(1.4, (t) => this.setLight(1 - t), signal);
  }

  protected override resetDemo(): void {
    this.setLight(0);
  }
}
