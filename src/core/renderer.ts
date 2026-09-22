import * as THREE from 'three';
import type { Quality } from '../app/store';

export interface QualityPreset {
  /** devicePixelRatio の上限 */
  pixelRatio: number;
  shadowMapSize: number;
  /** 作品の Canvas テクスチャの長辺（px） */
  artTextureSize: number;
  /** 鏡（Reflector）の解像度倍率 */
  reflectorScale: number;
}

export const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  low: { pixelRatio: 1, shadowMapSize: 1024, artTextureSize: 1024, reflectorScale: 0.35 },
  medium: { pixelRatio: 1.5, shadowMapSize: 2048, artTextureSize: 2048, reflectorScale: 0.6 },
  high: { pixelRatio: 2, shadowMapSize: 4096, artTextureSize: 2048, reflectorScale: 1 },
};

export function createRenderer(container: HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    // E2E で画素値を読むために描画結果を保持する
    preserveDrawingBuffer: import.meta.env.MODE === 'e2e',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // トーンマッピングは建築部分だけに効く。作品面のマテリアルは toneMapped: false にする（§4.6）
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 影を落とすのは静的な建築だけなので、最初に 1 回だけ更新する（§10）
  renderer.shadowMap.autoUpdate = false;
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  return renderer;
}

export function applyQuality(renderer: THREE.WebGLRenderer, quality: Quality): void {
  const preset = QUALITY_PRESETS[quality];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatio));
}

/** GPU とデバイスの情報から初期画質を推定する */
export function detectQuality(renderer: THREE.WebGLRenderer): Quality {
  const gl = renderer.getContext();
  let gpu = '';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '');
  const isSoftware = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
  if (isSoftware) return 'low';

  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  if (isMobile) return 'low';

  const discrete = /nvidia|geforce|rtx|radeon rx|radeon pro|apple m\d (pro|max|ultra)/i.test(gpu);
  if (discrete) return 'high';
  return 'medium';
}

export function getGpuName(renderer: THREE.WebGLRenderer): string {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '') : 'unknown';
}
