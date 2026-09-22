import * as THREE from 'three';

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export interface ArtCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
  /** 描き直してテクスチャを更新する */
  redraw(draw: Draw): void;
}

/**
 * 作品用の Canvas テクスチャ（§4.6）。
 * 長辺を longSide px にし、sRGB・ミップマップ・最大の異方性フィルタを使う。
 * aspect は 幅 / 高さ。
 */
export function createArtCanvas(
  aspect: number,
  longSide: number,
  draw: Draw,
  renderer?: THREE.WebGLRenderer,
): ArtCanvas {
  const width = aspect >= 1 ? longSide : Math.round(longSide * aspect);
  const height = aspect >= 1 ? Math.round(longSide / aspect) : longSide;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('2D コンテキストを取得できません');
  draw(ctx, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;

  return {
    canvas,
    ctx,
    texture,
    width,
    height,
    redraw(next: Draw) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.restore();
      next(ctx, width, height);
      texture.needsUpdate = true;
    },
  };
}

/** 作品面のマテリアル: 照明もトーンマッピングも受けず、画素値をそのまま出す（§4.6） */
export function artMaterial(map: THREE.Texture | null, opts: { transparent?: boolean } = {}) {
  return new THREE.MeshBasicMaterial({
    map,
    toneMapped: false,
    transparent: opts.transparent ?? false,
  });
}

/** 文字列を Canvas に収まる大きさで描く */
export function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  weight = 600,
  family = '"Hiragino Sans","Noto Sans JP","Yu Gothic UI","Meiryo",sans-serif',
): void {
  ctx.font = `${weight} ${size}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w > maxWidth) ctx.font = `${weight} ${Math.floor((size * maxWidth) / w)}px ${family}`;
  ctx.fillText(text, x, y);
}
