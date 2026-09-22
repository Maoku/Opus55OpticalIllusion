/**
 * キーボード・マウス・タッチの入力をまとめて扱う。
 * 移動はキーとバーチャルスティックの合成、視点はポインタロック中のマウス移動とドラッグの合成。
 */

export type KeyHandler = (e: KeyboardEvent) => void;

const MOVE_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
} as const;

/** クリック（ドラッグではない）とみなす移動量の上限（px） */
const CLICK_SLOP = 6;

export class InputManager {
  private readonly down = new Set<string>();
  private lookDX = 0;
  private lookDY = 0;
  private stickX = 0;
  private stickY = 0;
  private readonly keyHandlers = new Set<KeyHandler>();
  private readonly clickHandlers = new Set<(e: PointerEvent) => void>();
  private readonly abort = new AbortController();
  private drag: { id: number; x: number; y: number; startX: number; startY: number } | null = null;

  /** ドラッグで視点を動かせるか（歩行モード・横ずらしのときに有効） */
  dragLookEnabled = true;

  constructor(private readonly element: HTMLElement) {
    const signal = this.abort.signal;
    window.addEventListener('keydown', (e) => this.onKeyDown(e), { signal });
    window.addEventListener('keyup', (e) => this.down.delete(e.code), { signal });
    window.addEventListener('blur', () => this.down.clear(), { signal });
    document.addEventListener(
      'mousemove',
      (e) => {
        if (this.pointerLocked) {
          this.lookDX += e.movementX;
          this.lookDY += e.movementY;
        }
      },
      { signal },
    );
    element.addEventListener('pointerdown', (e) => this.onPointerDown(e), { signal });
    element.addEventListener('pointermove', (e) => this.onPointerMove(e), { signal });
    element.addEventListener('pointerup', (e) => this.onPointerUp(e), { signal });
    element.addEventListener('pointercancel', () => (this.drag = null), { signal });
    element.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.element;
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** 前進方向を +y、右を +x とした移動入力（長さ 1 以下） */
  getMove(): { x: number; y: number; run: boolean } {
    const any = (codes: readonly string[]) => codes.some((c) => this.down.has(c));
    let x = (any(MOVE_KEYS.right) ? 1 : 0) - (any(MOVE_KEYS.left) ? 1 : 0) + this.stickX;
    let y = (any(MOVE_KEYS.forward) ? 1 : 0) - (any(MOVE_KEYS.back) ? 1 : 0) + this.stickY;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    const stickRun = Math.hypot(this.stickX, this.stickY) > 0.92;
    return { x, y, run: any(MOVE_KEYS.run) || stickRun };
  }

  /** 前回呼び出し以降の視点移動量（px）を取り出す */
  consumeLook(): { dx: number; dy: number } {
    const d = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0;
    this.lookDY = 0;
    return d;
  }

  addLook(dx: number, dy: number): void {
    this.lookDX += dx;
    this.lookDY += dy;
  }

  setStick(x: number, y: number): void {
    this.stickX = x;
    this.stickY = y;
  }

  onKey(handler: KeyHandler): () => void {
    this.keyHandlers.add(handler);
    return () => this.keyHandlers.delete(handler);
  }

  /** キャンバス上のクリック（タップ）。ドラッグしたときは呼ばれない */
  onClick(handler: (e: PointerEvent) => void): () => void {
    this.clickHandlers.add(handler);
    return () => this.clickHandlers.delete(handler);
  }

  requestPointerLock(): void {
    if (this.pointerLocked || !this.element.requestPointerLock) return;
    try {
      const result = this.element.requestPointerLock() as unknown;
      if (result instanceof Promise) result.catch(() => undefined);
    } catch {
      // ポインタロックが使えない環境ではドラッグ操作にフォールバックする
    }
  }

  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock();
  }

  clearKeys(): void {
    this.down.clear();
    this.stickX = 0;
    this.stickY = 0;
  }

  dispose(): void {
    this.abort.abort();
    this.keyHandlers.clear();
    this.clickHandlers.clear();
  }

  private onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    const typing =
      !!target &&
      (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
    if (typing) return;
    this.down.add(e.code);
    for (const h of this.keyHandlers) h(e);
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.pointerLocked) {
      for (const h of this.clickHandlers) h(e);
      return;
    }
    this.drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
    };
    this.element.setPointerCapture?.(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drag || this.drag.id !== e.pointerId || this.pointerLocked) return;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    if (this.dragLookEnabled) {
      // ドラッグは「つかんで回す」感覚にするため、マウス移動より少し強めにする
      const k = e.pointerType === 'touch' ? 1.6 : 1.2;
      this.addLook(-dx * k, -dy * k);
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.drag || this.drag.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY);
    this.drag = null;
    if (moved <= CLICK_SLOP) for (const h of this.clickHandlers) h(e);
  }
}
