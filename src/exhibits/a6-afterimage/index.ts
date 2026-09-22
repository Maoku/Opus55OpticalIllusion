import * as THREE from 'three';
import { FlatArtExhibit } from '../common/FlatArtExhibit';
import type { ExhibitContext, PanelAction } from '../types';
import { mulberry32 } from '../../world/materials';
import { CHROMA_GAIN, phaseAt, type AfterimagePhase } from './pattern';

const MODE: Record<AfterimagePhase, number> = { idle: 0, fixate: 1, after: 2, diagram: 3 };

/** 自然な色の風景（補色版と白黒版の元になる） */
function paintLandscape(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const rand = mulberry32(42);
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, '#2f7fd6');
  sky.addColorStop(1, '#9fd3ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // 太陽
  ctx.fillStyle = '#ffd21f';
  ctx.beginPath();
  ctx.arc(w * 0.2, h * 0.2, h * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // 雲
  ctx.fillStyle = '#ffffff';
  for (const [x, y, s] of [
    [0.55, 0.16, 1],
    [0.8, 0.26, 0.8],
  ] as const) {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(
        w * (x + (i - 2) * 0.035 * s),
        h * (y - (i % 2) * 0.02),
        h * 0.045 * s,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  // 遠くの丘
  ctx.fillStyle = '#4f9a3c';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  for (let i = 0; i <= 40; i++) {
    const x = (w * i) / 40;
    ctx.lineTo(x, h * (0.55 - 0.06 * Math.sin((x / w) * 5.2 + 0.4)));
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  // 湖
  ctx.fillStyle = '#2b78c9';
  ctx.beginPath();
  ctx.ellipse(w * 0.72, h * 0.68, w * 0.2, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  // 手前の草地
  ctx.fillStyle = '#2f8f2a';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.74);
  ctx.quadraticCurveTo(w * 0.5, h * 0.68, w, h * 0.78);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  // 家
  const hx = w * 0.3;
  const hy = h * 0.6;
  ctx.fillStyle = '#f7f1e3';
  ctx.fillRect(hx, hy, w * 0.12, h * 0.12);
  ctx.fillStyle = '#d0302b';
  ctx.beginPath();
  ctx.moveTo(hx - w * 0.015, hy);
  ctx.lineTo(hx + w * 0.06, hy - h * 0.09);
  ctx.lineTo(hx + w * 0.135, hy);
  ctx.fill();
  ctx.fillStyle = '#1f4fb0';
  ctx.fillRect(hx + w * 0.045, hy + h * 0.05, w * 0.03, h * 0.07);
  // 木
  ctx.fillStyle = '#7a4a24';
  ctx.fillRect(w * 0.12, h * 0.52, w * 0.018, h * 0.2);
  ctx.fillStyle = '#237a26';
  ctx.beginPath();
  ctx.arc(w * 0.129, h * 0.48, h * 0.1, 0, Math.PI * 2);
  ctx.fill();
  // 花（赤・黄・紫）
  const colors = ['#e3212f', '#e3212f', '#f5c400', '#b0288f'];
  for (let i = 0; i < 70; i++) {
    const x = rand() * w;
    const y = h * (0.8 + rand() * 0.18);
    ctx.strokeStyle = '#1f6b1c';
    ctx.lineWidth = h * 0.004;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h * 0.03);
    ctx.stroke();
    ctx.fillStyle = colors[i % colors.length]!;
    ctx.beginPath();
    ctx.arc(x, y, h * (0.011 + rand() * 0.006), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 錐体の順応の説明図 */
function paintDiagram(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#f7f6f2';
  ctx.fillRect(0, 0, w, h);
  const font = (size: number, weight = 700) =>
    `${weight} ${Math.round(h * size)}px "Hiragino Sans","Noto Sans JP","Yu Gothic UI",sans-serif`;
  ctx.fillStyle = '#1c1c1e';
  ctx.textAlign = 'center';
  ctx.font = font(0.06);
  ctx.fillText('残像のしくみ（錐体の順応）', w / 2, h * 0.11);

  const panels = [
    { title: '① シアンを見つめる', patch: '#27d3d3', sens: [1, 1, 1], resp: [0.15, 0.85, 0.8] },
    {
      title: '② 緑と青の錐体が疲れる',
      patch: '#27d3d3',
      sens: [1, 0.45, 0.5],
      resp: [0.15, 0.4, 0.4],
    },
    {
      title: '③ 白を見ると赤く感じる',
      patch: '#dcdcdc',
      sens: [1, 0.45, 0.5],
      resp: [0.85, 0.38, 0.42],
    },
  ];
  const cones = [
    { label: 'L（赤）', color: '#e03131' },
    { label: 'M（緑）', color: '#2f9e44' },
    { label: 'S（青）', color: '#1c7ed6' },
  ];
  const pw = w / 3;
  panels.forEach((p, i) => {
    const x0 = pw * i + pw * 0.08;
    const inner = pw * 0.84;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = h * 0.004;
    ctx.beginPath();
    ctx.roundRect(x0, h * 0.18, inner, h * 0.74, h * 0.02);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1c1c1e';
    ctx.font = font(0.042);
    ctx.fillText(p.title, x0 + inner / 2, h * 0.26);
    ctx.fillStyle = p.patch;
    ctx.fillRect(x0 + inner * 0.3, h * 0.3, inner * 0.4, h * 0.14);
    ctx.font = font(0.032, 600);
    cones.forEach((c, k) => {
      const bx = x0 + inner * (0.15 + k * 0.27);
      const bw = inner * 0.16;
      const base = h * 0.84;
      const full = h * 0.3;
      // 感度（枠）と反応（塗り）
      ctx.strokeStyle = c.color;
      ctx.lineWidth = h * 0.004;
      ctx.strokeRect(bx, base - full * p.sens[k]!, bw, full * p.sens[k]!);
      ctx.fillStyle = c.color;
      ctx.fillRect(bx, base - full * p.resp[k]!, bw, full * p.resp[k]!);
      ctx.fillStyle = '#3a3a3f';
      ctx.fillText(c.label, bx + bw / 2, h * 0.895);
    });
  });
  ctx.font = font(0.03, 500);
  ctx.fillStyle = '#55555a';
  ctx.fillText('枠 = 感度　塗り = 反応の強さ', w / 2, h * 0.975);
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D diagram;
  uniform float mode;
  uniform float progress;
  uniform float aspect;
  uniform float chromaGain;
  varying vec2 vUv;

  // BT.601 の輝度（sRGB の値で計算する。pattern.ts の luma と同じ式）
  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  float disc(vec2 p, vec2 c, float r) {
    float d = length(p - c);
    return 1.0 - smoothstep(r - fwidth(d), r + fwidth(d), d);
  }

  void main() {
    vec2 p = vec2(vUv.x * aspect, vUv.y);
    vec3 lin = texture2D(map, vUv).rgb;
    vec3 s = sRGBTransferOETF(vec4(lin, 1.0)).rgb;
    float y = luma(s);
    vec3 outS;
    if (mode < 0.5) {
      // 待機: 白黒を淡く表示し、再生ボタンを描く
      outS = mix(vec3(y), vec3(0.97), 0.55);
      vec2 c = vec2(0.5 * aspect, 0.5);
      float ring = disc(p, c, 0.13) - disc(p, c, 0.118);
      outS = mix(outS, vec3(0.15), ring);
      vec2 q = (p - c) / 0.06;
      float tri = step(-0.55, q.x) * step(q.x * 0.55 + abs(q.y) * 0.95, 0.5);
      outS = mix(outS, vec3(0.15), tri);
    } else if (mode < 1.5) {
      // 補色の風景
      outS = clamp(vec3(y) - (s - vec3(y)) * chromaGain, 0.0, 1.0);
    } else if (mode < 2.5) {
      outS = vec3(y);
    } else {
      outS = sRGBTransferOETF(vec4(texture2D(diagram, vUv).rgb, 1.0)).rgb;
    }

    if (mode > 0.5 && mode < 2.5) {
      // 注視点
      vec2 c = vec2(0.5 * aspect, 0.5);
      outS = mix(outS, vec3(1.0), disc(p, c, 0.014));
      outS = mix(outS, vec3(0.0), disc(p, c, 0.009));
    }
    if (mode > 0.5 && mode < 1.5) {
      // 円形のカウントダウン（右下）
      vec2 c = vec2(aspect - 0.1, 0.1);
      vec2 d = p - c;
      float r = length(d);
      float band = smoothstep(0.048, 0.05, r) - smoothstep(0.062, 0.064, r);
      float ang = atan(d.x, d.y) / 6.2831853 + 0.5;
      float remain = step(ang, 1.0 - progress);
      outS = mix(outS, vec3(1.0), band * 0.35);
      outS = mix(outS, vec3(1.0), band * remain);
    }
    gl_FragColor = sRGBTransferEOTF(vec4(outS, 1.0));
    #include <colorspace_fragment>
  }
`;

export class AfterimageExhibit extends FlatArtExhibit {
  readonly id = 'afterimage' as const;
  protected readonly artWidth = 2.3;
  protected readonly aspect = 1.5;
  private material: THREE.ShaderMaterial | null = null;
  private diagram: THREE.CanvasTexture | null = null;
  /** 「はじめる」からの経過秒数（負なら待機中） */
  private elapsed = -1;
  private showingDiagram = false;

  readonly panelActions: PanelAction[] = [
    { id: 'start', label: 'はじめる', run: () => this.start() },
  ];

  protected paint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    paintLandscape(ctx, w, h);
  }

  protected override build(ctx: ExhibitContext): void {
    super.build(ctx);
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(2048, ctx.textureSize);
    canvas.height = Math.round(canvas.width / this.aspect);
    paintDiagram(canvas.getContext('2d')!, canvas.width, canvas.height);
    this.diagram = new THREE.CanvasTexture(canvas);
    this.diagram.colorSpace = THREE.SRGBColorSpace;
    this.diagram.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: this.art!.texture },
        diagram: { value: this.diagram },
        mode: { value: 0 },
        progress: { value: 0 },
        aspect: { value: this.aspect },
        chromaGain: { value: CHROMA_GAIN },
      },
      vertexShader,
      fragmentShader,
      toneMapped: false,
    });
    const art = this.framed!.art;
    art.material.dispose();
    (art as unknown as THREE.Mesh).material = this.material;
  }

  start(): void {
    this.showingDiagram = false;
    this.elapsed = 0;
    this.sync();
  }

  get phase(): AfterimagePhase {
    return this.showingDiagram ? 'diagram' : phaseAt(this.elapsed).phase;
  }

  private sync(): void {
    if (!this.material) return;
    const { phase, progress } = this.showingDiagram
      ? { phase: 'diagram' as const, progress: 0 }
      : phaseAt(this.elapsed);
    this.material.uniforms.mode!.value = MODE[phase];
    this.material.uniforms.progress!.value = progress;
  }

  update(dt: number): void {
    if (this.elapsed < 0) return;
    this.elapsed += dt;
    if (phaseAt(this.elapsed).phase === 'idle') this.elapsed = -1;
    this.sync();
  }

  onExitView(): void {
    this.elapsed = -1;
    this.showingDiagram = false;
    this.sync();
  }

  protected override async demo(signal: AbortSignal): Promise<boolean> {
    this.elapsed = -1;
    this.showingDiagram = true;
    this.sync();
    return this.wait(12, signal);
  }

  protected override resetDemo(): void {
    this.showingDiagram = false;
    this.sync();
  }

  override dispose(): void {
    super.dispose();
    this.diagram?.dispose();
  }
}
