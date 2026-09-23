import { DEFAULT_SETTINGS, type Settings } from './store';

/**
 * ブラウザの localStorage に、設定と鑑賞履歴（鑑賞済み・ヒント閲覧済み）だけを保存する。
 * プライベートウィンドウなどで使えないときは何もしない（アプリは保存なしで動く）。
 */

const KEY = 'oim:v1';

export interface Saved {
  settings: Settings;
  visited: string[];
  hintViewed: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** 保存された値を検証しながら読み込む（壊れた値は既定値に置き換える） */
export function parseSaved(raw: string | null): Saved {
  const empty: Saved = { settings: { ...DEFAULT_SETTINGS }, visited: [], hintViewed: [] };
  if (!raw) return empty;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!isRecord(data)) return empty;
  const s = isRecord(data.settings) ? data.settings : {};
  const num = (v: unknown, min: number, max: number, def: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
  const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
  const quality = ['auto', 'low', 'medium', 'high'].includes(s.quality as string)
    ? (s.quality as Settings['quality'])
    : DEFAULT_SETTINGS.quality;
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 100) : [];
  return {
    settings: {
      quality,
      mouseSensitivity: num(s.mouseSensitivity, 0.2, 3, DEFAULT_SETTINGS.mouseSensitivity),
      fov: num(s.fov, 50, 100, DEFAULT_SETTINGS.fov),
      invertY: bool(s.invertY, DEFAULT_SETTINGS.invertY),
      reducedMotion: bool(s.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
      muted: bool(s.muted, DEFAULT_SETTINGS.muted),
    },
    visited: strings(data.visited),
    hintViewed: strings(data.hintViewed),
  };
}

export function loadSaved(): { saved: Saved; hadSettings: boolean } {
  try {
    const raw = window.localStorage.getItem(KEY);
    return { saved: parseSaved(raw), hadSettings: raw !== null };
  } catch {
    return { saved: parseSaved(null), hadSettings: false };
  }
}

export function save(data: Saved): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 保存できない環境では何もしない
  }
}

export function clearSaved(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 何もしない
  }
}
