import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Rect } from './layout';

export interface LightingRig {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  environment: THREE.Texture;
  dispose(): void;
}

/** 太陽の方向（光源へ向かう向き）。南東の高い位置から天窓を通して差し込む */
const SUN_DIR = new THREE.Vector3(0.32, 1, 0.42).normalize();

export function createLighting(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  area: Rect,
  shadowMapSize: number,
): LightingRig {
  const group = new THREE.Group();
  group.name = 'lighting';

  // 環境マップ: 白い室内の柔らかい反射（磨いた床に効く）
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const environment = pmrem.fromScene(envScene, 0.04).texture;
  envScene.dispose();
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.55;

  const hemi = new THREE.HemisphereLight(0xffffff, 0xc9c2b8, 1.35);
  group.add(hemi);

  // 天窓の平行光。建築（天井・壁）が影を落とし、天窓の下だけに光だまりができる
  const sun = new THREE.DirectionalLight(0xfff4e2, 2.6);
  const center = new THREE.Vector3((area.x0 + area.x1) / 2, 0, (area.z0 + area.z1) / 2);
  sun.position.copy(center).addScaledVector(SUN_DIR, 80);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  fitShadowCamera(sun, area);
  group.add(sun, sun.target);

  return {
    group,
    sun,
    environment,
    dispose() {
      environment.dispose();
      sun.shadow.map?.dispose();
    },
  };
}

/** 館全体を覆うように平行光の影カメラの範囲を決める */
function fitShadowCamera(sun: THREE.DirectionalLight, area: Rect): void {
  const view = new THREE.Matrix4().lookAt(
    sun.position,
    sun.target.position,
    new THREE.Vector3(0, 1, 0),
  );
  view.setPosition(sun.position);
  const inv = view.clone().invert();
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const p = new THREE.Vector3();
  for (const x of [area.x0 - 2, area.x1 + 2]) {
    for (const y of [0, 10]) {
      for (const z of [area.z0 - 2, area.z1 + 2]) {
        p.set(x, y, z).applyMatrix4(inv);
        min.min(p);
        max.max(p);
      }
    }
  }
  const cam = sun.shadow.camera;
  cam.left = min.x;
  cam.right = max.x;
  cam.bottom = min.y;
  cam.top = max.y;
  cam.near = Math.max(0.5, -max.z - 5);
  cam.far = -min.z + 5;
  cam.updateProjectionMatrix();
}

/** 外の空（グラデーション）と地面 */
export function createExterior(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'exterior';

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      top: { value: new THREE.Color(0x6f9fd6) },
      horizon: { value: new THREE.Color(0xe8eef2) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 c = mix(horizon, top, pow(h, 0.55));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: 0x9aa58a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  group.add(ground);

  // 石畳のアプローチ
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 22),
    new THREE.MeshStandardMaterial({ color: 0xc9c4ba, roughness: 0.9 }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, -0.03, 25);
  plaza.receiveShadow = true;
  group.add(plaza);

  // ガラス越しに見える木立（簡単な形）
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b5847, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x5f7f52,
    roughness: 1,
    flatShading: true,
  });
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 3, 6);
  const leafGeo = new THREE.IcosahedronGeometry(1.6, 0);
  const spots: [number, number][] = [
    [-14, 22],
    [12, 24],
    [-20, 30],
    [18, 32],
    [-12, -36],
    [-3, -40],
    [7, -35],
    [-18, -42],
    [14, -44],
  ];
  for (const [x, z] of spots) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1.5, z);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 3.6, z);
    leaves.scale.setScalar(0.9 + ((x * 7 + z * 3) % 5) * 0.08);
    group.add(trunk, leaves);
  }
  return group;
}
