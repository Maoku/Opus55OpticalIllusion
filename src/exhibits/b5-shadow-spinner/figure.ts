import * as THREE from 'three';

/**
 * 回る影の人型（独自のモデル）。カプセルを組み合わせた、片足で立って両腕を広げた姿。
 * 高さ約 1.7（任意単位）。原点は立ち足のつま先の下（回転軸）。
 */
export interface FigureParts {
  group: THREE.Group;
  /** 脚（デモで陰影をつける部分） */
  legs: THREE.Mesh[];
  /** それ以外 */
  body: THREE.Mesh[];
}

function capsule(
  from: THREE.Vector3Tuple,
  to: THREE.Vector3Tuple,
  radius: number,
  mat: THREE.Material,
): THREE.Mesh {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const g = new THREE.CapsuleGeometry(radius, len, 6, 16);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

export function createFigure(mat: THREE.Material): FigureParts {
  const group = new THREE.Group();
  const legs: THREE.Mesh[] = [];
  const body: THREE.Mesh[] = [];
  const add = (list: THREE.Mesh[], m: THREE.Mesh) => {
    list.push(m);
    group.add(m);
  };
  // 立ち足（軸の上）
  add(legs, capsule([0, 0.05, 0], [0.02, 0.48, 0], 0.055, mat));
  add(legs, capsule([0.02, 0.48, 0], [0.04, 0.9, 0], 0.065, mat));
  // 上げた足: 腰から前方斜め上へ伸ばし、膝から下を曲げる
  add(legs, capsule([0.06, 0.92, 0.02], [0.2, 0.9, 0.36], 0.065, mat));
  add(legs, capsule([0.2, 0.9, 0.36], [0.44, 0.72, 0.52], 0.055, mat));
  add(legs, capsule([0.44, 0.72, 0.52], [0.52, 0.72, 0.62], 0.035, mat));
  // 胴と頭
  add(body, capsule([0.04, 0.95, 0], [0.02, 1.38, -0.02], 0.12, mat));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), mat);
  head.position.set(0.0, 1.58, -0.03);
  add(body, head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), mat);
  hair.position.set(-0.02, 1.66, -0.12);
  add(body, hair);
  // 腕: 片方は上へ、もう片方は横へ
  add(body, capsule([0.1, 1.33, 0], [0.32, 1.55, 0.05], 0.04, mat));
  add(body, capsule([0.32, 1.55, 0.05], [0.4, 1.82, 0.1], 0.035, mat));
  add(body, capsule([-0.1, 1.33, 0], [-0.38, 1.3, -0.12], 0.04, mat));
  add(body, capsule([-0.38, 1.3, -0.12], [-0.62, 1.36, -0.22], 0.035, mat));
  // スカート
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.22, 20, 1, true), mat);
  skirt.position.set(0.04, 0.93, 0);
  add(body, skirt);
  return { group, legs, body };
}
