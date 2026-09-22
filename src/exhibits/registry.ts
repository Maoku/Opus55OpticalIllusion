import type { ExhibitId } from '../content/types';
import type { ExhibitFactory } from './types';
import { CafeWallExhibit } from './a1-cafe-wall';
import { EbbinghausExhibit } from './a2-ebbinghaus';

/** 展示 ID → ファクトリ。ここに登録した展示が館内に配置される */
export const REGISTRY: Partial<Record<ExhibitId, ExhibitFactory>> = {
  'cafe-wall': () => new CafeWallExhibit(),
  ebbinghaus: () => new EbbinghausExhibit(),
};

export function registeredIds(): ExhibitId[] {
  return Object.keys(REGISTRY) as ExhibitId[];
}
