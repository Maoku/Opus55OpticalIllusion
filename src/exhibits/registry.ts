import type { ExhibitId } from '../content/types';
import type { ExhibitFactory } from './types';
import { WelcomeAnamorphosisExhibit } from './e1-welcome-anamorphosis';
import { CafeWallExhibit } from './a1-cafe-wall';
import { EbbinghausExhibit } from './a2-ebbinghaus';
import { MullerLyerExhibit } from './a3-muller-lyer';
import { ScintillatingGridExhibit } from './a4-scintillating-grid';
import { PeripheralDriftExhibit } from './a5-peripheral-drift';
import { AfterimageExhibit } from './a6-afterimage';
import { AmesRoomExhibit } from './b1-ames-room';
import { ImpossibleTriangleExhibit } from './b2-impossible-triangle';
import { CheckerShadowExhibit } from './b3-checker-shadow';
import { ReverspectiveExhibit } from './b4-reverspective';
import { ShadowSpinnerExhibit } from './b5-shadow-spinner';
import { CircleHeartExhibit } from './c1-circle-heart';
import { ColorlessFruitExhibit } from './c2-colorless-fruit';

/** 展示 ID → ファクトリ。ここに登録した展示が館内に配置される */
export const REGISTRY: Partial<Record<ExhibitId, ExhibitFactory>> = {
  'welcome-anamorphosis': () => new WelcomeAnamorphosisExhibit(),
  'cafe-wall': () => new CafeWallExhibit(),
  ebbinghaus: () => new EbbinghausExhibit(),
  'muller-lyer': () => new MullerLyerExhibit(),
  'scintillating-grid': () => new ScintillatingGridExhibit(),
  'peripheral-drift': () => new PeripheralDriftExhibit(),
  afterimage: () => new AfterimageExhibit(),
  'ames-room': () => new AmesRoomExhibit(),
  'impossible-triangle': () => new ImpossibleTriangleExhibit(),
  'checker-shadow': () => new CheckerShadowExhibit(),
  reverspective: () => new ReverspectiveExhibit(),
  'shadow-spinner': () => new ShadowSpinnerExhibit(),
  'circle-heart': () => new CircleHeartExhibit(),
  'colorless-fruit': () => new ColorlessFruitExhibit(),
};

export function registeredIds(): ExhibitId[] {
  return Object.keys(REGISTRY) as ExhibitId[];
}
