import type * as THREE from 'three';
import type { Quality } from '../app/store';
import type { ExhibitId } from '../content/types';
import type { Collider } from '../world/collision';

export type Vec3 = readonly [number, number, number];

/** 鑑賞モードのカメラ（すべて展示ローカル座標。展示の正面は +Z 方向） */
export type ViewMode =
  /**
   * 作品の正面に立って見る（平面作品）。
   * width × height の作品面が画面の fill（既定 0.7）を占める距離にカメラを置く
   */
  | {
      kind: 'front';
      center: Vec3;
      width: number;
      height: number;
      fill?: number;
      fov?: number;
    }
  /** 視点を固定して見る（視点に依存する作品）。allowShift は左右にずらせる上限（m） */
  | { kind: 'fixed'; position: Vec3; target: Vec3; fov: number; allowShift?: number };

/** カメラ演出の姿勢（展示ローカル座標） */
export interface CameraShot {
  position: Vec3;
  target: Vec3;
  fov?: number;
  /** 経由点。指定すると位置を 2 次ベジェ曲線で動かす（回り込む演出用） */
  via?: Vec3;
}

export interface ExhibitCameraControl {
  /** カメラを指定の姿勢へ動かす。中断されたら false */
  flyTo(shot: CameraShot, duration?: number, signal?: AbortSignal): Promise<boolean>;
  /** 鑑賞モードの推奨視点へ戻す */
  returnToView(duration?: number, signal?: AbortSignal): Promise<boolean>;
}

export interface ExhibitContext {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  quality: Quality;
  /** 作品テクスチャの長辺（px） */
  textureSize: number;
  reducedMotion: boolean;
  rig: ExhibitCameraControl;
}

export interface Exhibit {
  readonly id: ExhibitId;
  /** 展示の 3D オブジェクト（ローカル座標） */
  readonly root: THREE.Object3D;
  /** 鑑賞モードのカメラ */
  readonly viewMode: ViewMode;
  /** 歩行の障害物（ローカル座標）。台座・ブースなど */
  readonly colliders?: Collider[];
  /** キャプションプレートの位置（ローカル座標）。null で表示しない */
  readonly captionAnchor?: { position: Vec3; rotationY?: number } | null;
  /** 床の「ここから見る」マーク。既定は fixed のときだけ表示する */
  readonly floorMark?: boolean;

  /** テクスチャ生成などの重い処理。コンストラクタでは DOM に触れない */
  init(ctx: ExhibitContext): Promise<void>;
  /** 近くにいるとき・鑑賞中だけ呼ばれる */
  update?(dt: number, ctx: ExhibitContext): void;
  /** 3D 側のヒント表現（ガイド線など） */
  setHintVisible?(visible: boolean): void;
  /** 種明かしデモ。最後まで再生したら true、中断されたら false */
  playDemo?(): Promise<boolean>;
  stopDemo?(): void;
  onEnterView?(): void;
  onExitView?(): void;
  /** 鑑賞中のクリック・タップ。座標は正規化デバイス座標（-1〜1） */
  onViewClick?(ndc: { x: number; y: number }): void;
  /** テスト用の名前付きの点（展示ローカル座標）。E2E で画素値を調べる位置など */
  readonly debugPoints?: Record<string, Vec3>;
  /** 鑑賞パネルに追加する操作（例: 残像の「はじめる」） */
  readonly panelActions?: PanelAction[];
  dispose(): void;
}

export interface PanelAction {
  id: string;
  label: string;
  run(): void | Promise<void>;
}

export type ExhibitFactory = () => Exhibit;
