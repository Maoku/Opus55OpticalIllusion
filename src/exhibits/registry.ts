import type { ExhibitId } from '../content/types';
import type { ExhibitFactory } from './types';

/** 展示 ID → ファクトリ。ここに登録した展示が館内に配置される */
export const REGISTRY: Partial<Record<ExhibitId, ExhibitFactory>> = {
};

export function registeredIds(): ExhibitId[] {
  return Object.keys(REGISTRY) as ExhibitId[];
}
