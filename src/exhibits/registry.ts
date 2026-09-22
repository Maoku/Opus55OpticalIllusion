import type { ExhibitId } from '../content/types';
import type { ExhibitFactory } from './types';
import { CafeWallExhibit } from './a1-cafe-wall';
import { EbbinghausExhibit } from './a2-ebbinghaus';
import { MullerLyerExhibit } from './a3-muller-lyer';
import { ScintillatingGridExhibit } from './a4-scintillating-grid';
import { PeripheralDriftExhibit } from './a5-peripheral-drift';
import { AfterimageExhibit } from './a6-afterimage';
import { AmesRoomExhibit } from './b1-ames-room';

/** 展示 ID → ファクトリ。ここに登録した展示が館内に配置される */
export const REGISTRY: Partial<Record<ExhibitId, ExhibitFactory>> = {
  'cafe-wall': () => new CafeWallExhibit(),
  ebbinghaus: () => new EbbinghausExhibit(),
  'muller-lyer': () => new MullerLyerExhibit(),
  'scintillating-grid': () => new ScintillatingGridExhibit(),
  'peripheral-drift': () => new PeripheralDriftExhibit(),
  afterimage: () => new AfterimageExhibit(),
  'ames-room': () => new AmesRoomExhibit(),
};

export function registeredIds(): ExhibitId[] {
  return Object.keys(REGISTRY) as ExhibitId[];
}
