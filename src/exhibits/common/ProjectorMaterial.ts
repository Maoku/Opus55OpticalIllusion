import * as THREE from 'three';

/**
 * 射影テクスチャ（計画書 §4.7）。視点 P に置いた仮想プロジェクタから画像を「投影」して、
 * 任意の面に描く。P から見ると、どの面に描かれた断片も元の 1 枚の画像に戻る。
 *
 * 投影は展示ローカル座標で行う。メッシュが展示の root 直下で単位行列のときは localMatrix を省略できる。
 * 照明もトーンマッピングも受けない（作品面の方針 §4.6）。
 */
export interface ProjectorOptions {
  /** 投影範囲の外の色（null なら描かない＝透明） */
  outside?: THREE.ColorRepresentation | null;
  /** メッシュの座標 → 展示ローカル座標 */
  localMatrix?: THREE.Matrix4;
  /** 半透明にするか（outside が null のとき自動で true） */
  transparent?: boolean;
  side?: THREE.Side;
}

const vertexShader = /* glsl */ `
  uniform mat4 projector;
  uniform mat4 localMatrix;
  varying vec4 vProj;
  void main() {
    vProj = projector * localMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 outsideColor;
  uniform float hasOutside;
  uniform float opacity;
  varying vec4 vProj;
  void main() {
    vec2 uv = vProj.xy / vProj.w * 0.5 + 0.5;
    bool inside = vProj.w > 0.0 && all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
    vec4 c;
    if (inside) {
      c = texture2D(map, uv);
    } else {
      if (hasOutside < 0.5) discard;
      c = vec4(outsideColor, 1.0);
    }
    if (c.a < 0.01) discard;
    gl_FragColor = vec4(c.rgb, c.a * opacity);
    #include <colorspace_fragment>
  }
`;

/** プロジェクタ（透視カメラ）のビュー射影行列 */
export function projectorMatrix(camera: THREE.PerspectiveCamera): THREE.Matrix4 {
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
}

export function createProjectorMaterial(
  map: THREE.Texture,
  projector: THREE.PerspectiveCamera,
  opts: ProjectorOptions = {},
): THREE.ShaderMaterial {
  const outside = opts.outside === undefined ? 0xffffff : opts.outside;
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      projector: { value: projectorMatrix(projector) },
      localMatrix: { value: opts.localMatrix ?? new THREE.Matrix4() },
      outsideColor: { value: new THREE.Color(outside ?? 0xffffff) },
      hasOutside: { value: outside === null ? 0 : 1 },
      opacity: { value: 1 },
    },
    vertexShader,
    fragmentShader,
    transparent: opts.transparent ?? outside === null,
    side: opts.side ?? THREE.FrontSide,
    toneMapped: false,
  });
}

/** プロジェクタ画像の座標（Canvas の px）に、展示ローカル座標の点を写す */
export function projectToCanvas(
  camera: THREE.PerspectiveCamera,
  p: THREE.Vector3Like,
  width: number,
  height: number,
): { x: number; y: number } {
  const v = new THREE.Vector3(p.x, p.y, p.z).project(camera);
  return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
}
