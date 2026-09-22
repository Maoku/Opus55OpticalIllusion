import {
  add,
  cross,
  dot,
  lookBasis,
  normalize,
  projectFrom,
  scale,
  sub,
  type V3,
  type ViewBasis,
} from '../common/viewpoint';

/**
 * 円とハートのあいだ: 筒の上縁の空間曲線を求めるソルバ。
 *
 * 視点 A（床マーク）から見ると上縁が「円」に、鏡越し（鏡に映った視点 B）から見ると「ハート」に見える曲線。
 * A と B を結ぶ直線を含む平面（エピポーラ平面）ごとに、
 *   - A の像で円とその平面の交線が交わる 2 点
 *   - B の像でハートとその平面の交線が交わる 2 点
 * を求め、対応する視線どうしの交点（三角測量）を上縁の点とする。平面が同じなので 2 本の視線は必ず交わる。
 * A から見て奥の点は「A の交線で視点側の交点」と「B の交線で遠い側の交点」の組になる。
 *
 * 正射影で近似しない（透視で厳密に解く）ので、固定視点から見た形は計算誤差の範囲で円・ハートに一致する。
 */

export type P2 = [number, number];

export interface Setup {
  eyeA: V3;
  /** 鏡の面（z = mirrorZ、+z 向き） */
  mirrorZ: number;
  /** 注視点（形の中心） */
  target: V3;
  /** 円の半径（m、注視点での大きさ） */
  radius: number;
}

export interface Rim {
  /** 閉じた上縁の曲線（A から見て手前の枝 → 奥の枝の順） */
  points: V3[];
  near: V3[];
  far: V3[];
  basisA: ViewBasis;
  basisB: ViewBasis;
  eyeB: V3;
  /** 像の座標での形 */
  circle: P2[];
  heart: P2[];
}

/** 鏡に映った視点 */
export function mirrorEye(eye: V3, mirrorZ: number): V3 {
  return [eye[0], eye[1], 2 * mirrorZ - eye[2]];
}

/** 円（像の座標、中心 0、半径 r）を多角形で */
export function circlePolygon(r: number, n = 4096): P2[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [r * Math.cos(t), r * Math.sin(t)] as P2;
  });
}

/** ハート（像の座標、中心 0、幅 2w）を多角形で。左右対称で、上に 2 つのふくらみ、下にとがった先 */
export function heartPolygon(w: number, n = 4096): P2[] {
  const k = w / 16;
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [x * k, (y + 2.5) * k] as P2;
  });
}

/** エピポーラ平面（A と B を結ぶ直線を含む）。psi は鉛直面からの傾き */
function epipolarNormal(eyeA: V3, eyeB: V3, psi: number): V3 {
  const axis = normalize(sub(eyeB, eyeA));
  // 鉛直面（x = eye.x）の法線 (1,0,0) を軸のまわりに psi 回す
  const n0: V3 = [1, 0, 0];
  const m = cross(axis, n0);
  return normalize(add(scale(n0, Math.cos(psi)), scale(m, Math.sin(psi))));
}

/** 像の上の直線 n·(fwd + u·right + v·up) = 0 と多角形の交点を、エピポールからの距離順に返す */
function lineHits(basis: ViewBasis, n: V3, poly: P2[]): P2[] {
  const fwd = scale(basis.back, -1);
  const a = dot(n, fwd);
  const b = dot(n, basis.right);
  const c = dot(n, basis.up);
  const hits: P2[] = [];
  const f = (p: P2) => a + b * p[0] + c * p[1];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const fp = f(p);
    const fq = f(q);
    if (fp === 0 || fp * fq < 0) {
      const t = fp / (fp - fq);
      hits.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  // エピポール（地平線の中央、像の上方）から近い順 = 像の上から順
  return hits.sort((p, q) => q[1] - p[1]);
}

/** 視線 eye + s·dir どうしの交点（2 本は同じ平面にあるので、最近点の中点をとる） */
function triangulate(e1: V3, d1: V3, e2: V3, d2: V3): V3 {
  const w = sub(e1, e2);
  const a = dot(d1, d1);
  const b = dot(d1, d2);
  const c = dot(d2, d2);
  const d = dot(d1, w);
  const e = dot(d2, w);
  const den = a * c - b * b;
  const s = (b * e - c * d) / den;
  const t = (a * e - b * d) / den;
  return scale(add(add(e1, scale(d1, s)), add(e2, scale(d2, t))), 0.5);
}

function rayDir(basis: ViewBasis, p: P2): V3 {
  return add(scale(basis.back, -1), add(scale(basis.right, p[0]), scale(basis.up, p[1])));
}

/** 平面が形と交わる最大の傾き psi を二分法で求める */
function maxPsi(eyeA: V3, eyeB: V3, basis: ViewBasis, poly: P2[]): number {
  let lo = 0;
  let hi = 0.6;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (lineHits(basis, epipolarNormal(eyeA, eyeB, mid), poly).length >= 2) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function solveRim(setup: Setup, samples = 180): Rim {
  const eyeA = setup.eyeA;
  const eyeB = mirrorEye(eyeA, setup.mirrorZ);
  const basisA = lookBasis(eyeA, setup.target);
  const basisB = lookBasis(eyeB, setup.target);
  const dist = Math.hypot(...sub(setup.target, eyeA));
  const circle = circlePolygon(setup.radius / dist);
  const psiMax = maxPsi(eyeA, eyeB, basisA, circle);

  // ハートの大きさを、交わる平面の範囲が円と同じになるように合わせる（上縁が閉じる条件）
  let lo = 0.01;
  let hi = 1;
  for (let i = 0; i < 50; i++) {
    const w = (lo + hi) / 2;
    if (maxPsi(eyeA, eyeB, basisB, heartPolygon(w, 1024)) < psiMax) lo = w;
    else hi = w;
  }
  const heart = heartPolygon((lo + hi) / 2);

  const near: V3[] = [];
  const far: V3[] = [];
  for (let i = 0; i <= samples; i++) {
    const psi = psiMax * Math.sin(-Math.PI / 2 + (Math.PI * i) / samples) * 0.999999;
    const n = epipolarNormal(eyeA, eyeB, psi);
    const ha = lineHits(basisA, n, circle);
    const hb = lineHits(basisB, n, heart);
    if (ha.length < 2 || hb.length < 2) continue;
    const aFirst = ha[0]!;
    const aLast = ha[ha.length - 1]!;
    const bFirst = hb[0]!;
    const bLast = hb[hb.length - 1]!;
    // A から見て奥の点: A の像では上（エピポール側）、B の像では下（遠い側）
    far.push(triangulate(eyeA, rayDir(basisA, aFirst), eyeB, rayDir(basisB, bLast)));
    near.push(triangulate(eyeA, rayDir(basisA, aLast), eyeB, rayDir(basisB, bFirst)));
  }
  const points = [...near, ...far.slice().reverse()];
  return { points, near, far, basisA, basisB, eyeB, circle, heart };
}

/** 点 p と多角形の境界との最短距離（像の座標） */
export function distanceToPolygon(p: P2, poly: P2[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby || 1)),
    );
    best = Math.min(best, Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t));
  }
  return best;
}

/** 像の座標への投影 */
export function imageOf(basis: ViewBasis, p: V3): P2 {
  const q = projectFrom(basis, p);
  return [q.x, q.y];
}
