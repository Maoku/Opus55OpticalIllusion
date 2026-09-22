export type AppMode = 'loading' | 'start' | 'walking' | 'viewing' | 'paused' | 'map' | 'settings';

export type QualitySetting = 'auto' | 'low' | 'medium' | 'high';
export type Quality = Exclude<QualitySetting, 'auto'>;

export type HintStage = 'hidden' | 'appearance' | 'mechanism';

export interface Settings {
  quality: QualitySetting;
  /** マウス感度（1 = 標準） */
  mouseSensitivity: number;
  /** 歩行時の垂直視野角（度） */
  fov: number;
  invertY: boolean;
  reducedMotion: boolean;
  muted: boolean;
}

export interface AppState {
  mode: AppMode;
  /** 一時停止・設定・マップを閉じたときに戻るモード */
  resumeMode: 'walking' | 'viewing';
  loadingProgress: number;
  /** 実際に使っている画質（auto のときは判定結果） */
  quality: Quality;
  settings: Settings;
  /** 鑑賞中の展示 */
  activeExhibitId: string | null;
  /** 近くにあって鑑賞できる展示 */
  nearbyExhibitId: string | null;
  hintStage: HintStage;
  demoPlaying: boolean;
  zoneId: string | null;
  visited: string[];
  hintViewed: string[];
}

type Listener = (state: AppState, prev: AppState) => void;

export class Store {
  private state: AppState;
  private readonly listeners = new Set<Listener>();

  constructor(initial: AppState) {
    this.state = initial;
  }

  get(): AppState {
    return this.state;
  }

  set(patch: Partial<AppState>): void {
    const prev = this.state;
    let changed = false;
    for (const key of Object.keys(patch) as (keyof AppState)[]) {
      if (!Object.is(prev[key], patch[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...prev, ...patch };
    for (const listener of this.listeners) listener(this.state, prev);
  }

  updateSettings(patch: Partial<Settings>): void {
    this.set({ settings: { ...this.state.settings, ...patch } });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 選択した値が変わったときだけ呼ばれる購読 */
  select<T>(selector: (s: AppState) => T, onChange: (value: T, prev: T) => void): () => void {
    return this.subscribe((state, prev) => {
      const a = selector(state);
      const b = selector(prev);
      if (!Object.is(a, b)) onChange(a, b);
    });
  }
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'auto',
  mouseSensitivity: 1,
  fov: 70,
  invertY: false,
  reducedMotion: false,
  muted: true,
};

export function createInitialState(settings: Settings, quality: Quality): AppState {
  return {
    mode: 'loading',
    resumeMode: 'walking',
    loadingProgress: 0,
    quality,
    settings,
    activeExhibitId: null,
    nearbyExhibitId: null,
    hintStage: 'hidden',
    demoPlaying: false,
    zoneId: null,
    visited: [],
    hintViewed: [],
  };
}
