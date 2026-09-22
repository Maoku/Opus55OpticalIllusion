export const EXHIBIT_IDS = [
  'welcome-anamorphosis',
  'cafe-wall',
  'ebbinghaus',
  'muller-lyer',
  'scintillating-grid',
  'peripheral-drift',
  'afterimage',
  'ames-room',
  'impossible-triangle',
  'checker-shadow',
  'reverspective',
  'shadow-spinner',
  'circle-heart',
  'colorless-fruit',
  'invisible-triangle',
] as const;

export type ExhibitId = (typeof EXHIBIT_IDS)[number];

export function isExhibitId(value: unknown): value is ExhibitId {
  return typeof value === 'string' && (EXHIBIT_IDS as readonly string[]).includes(value);
}

export type ExhibitZone = 'entrance' | 'plane' | 'spatial' | 'original';

export interface ExhibitContent {
  id: ExhibitId;
  /** 作品番号（例: 'A-1'） */
  number: string;
  zone: ExhibitZone;
  kind: 'classic' | 'original';
  title: string;
  titleEn: string;
  /** 発見者・年（classic のみ） */
  credit?: string;
  /** 鑑賞のしかた（常に表示。見え方は書かない） */
  howToView: string;
  hint: {
    /** どう見える？（「見え方のヒント」で表示） */
    appearance: string;
    /** なぜ？（「しくみを知る」で表示） */
    mechanism: string;
  };
  /** 「確かめる」ボタンの説明（例:「ガイド線を重ねる」） */
  demoLabel?: string;
  /** 光過敏などの個別注意 */
  caution?: string;
}
