# Optical Illusion Museum — 開発規約

ブラウザで歩ける 3D の錯視美術館。仕様は [Docs/IMPLEMENTATION_PLAN.md](Docs/IMPLEMENTATION_PLAN.md) を正とする。

## コマンド

| コマンド                          | 内容                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                     | 開発サーバー（http://localhost:5173）                        |
| `npm run build`                   | 本番ビルド（`dist/`）                                        |
| `npm run preview`                 | ビルド結果の確認                                             |
| `npm run lint` / `npm run format` | ESLint / Prettier                                            |
| `npm run typecheck`               | `tsc --noEmit`                                               |
| `npm test`                        | Vitest（`tests/unit`）                                       |
| `npm run e2e`                     | Playwright（`tests/e2e`）。`--mode e2e` でビルドして配信する |
| `npm run check`                   | lint → typecheck → test → build                              |

- TypeScript は typescript-eslint の対応範囲に合わせて 6.0 系に固定している
- E2E は Chromium ＋ SwiftShader（ソフトウェア WebGL）で動かす。画素値の検証は仕様上一致すべき箇所だけにする

## URL パラメータ

- `?exhibit=<id>` その作品の鑑賞モードを直接開く
- `?quality=low|medium|high` 画質を指定する
- `?debug` stats.js と lil-gui を表示する

## ディレクトリ規約

- `src/app` 初期化・メインループ・状態（`store.ts`）・テスト用 API（`debugApi.ts`）
- `src/core` レンダラ・入力などの基盤
- `src/world` 建築。`layout.ts` が部屋・壁・展示配置の唯一の宣言的データ
- `src/player` 移動とカメラ
- `src/exhibits` 展示。`<番号>-<id>/` に 1 作品ずつ置く（例: `a1-cafe-wall/`）
- `src/content/exhibits.ja.ts` 作品の文言（タイトル・鑑賞のしかた・ヒント）
- `src/ui` DOM の UI（フレームワークなし）
- `tests/unit` 純粋関数の単体テスト / `tests/e2e` Playwright

## コーディング規約

- 1 ユニット = 1m、目の高さ 1.6m、Y 軸が上
- 作品面は `MeshBasicMaterial` ＋ `toneMapped: false`、テクスチャは `SRGBColorSpace`（計画書 §4.6）
- 図形の計算（純粋関数、`pattern.ts` など）と Canvas への描画・3D 化（`index.ts`）を分け、前者を単体テストする
- 文言は `content/exhibits.ja.ts` に集約する。`howToView` に見え方（ネタバレ）を書かない
- 既存の有名作品の画像や形状は複製しない。原理に基づいて独自に作図する
- UI はキーボードで操作でき、ボタンには適切な `aria-*` をつける

## 展示を追加する手順

1. `src/content/exhibits.ja.ts` に文言を追加する（`ExhibitId` に ID を足す）
2. `src/exhibits/<番号>-<id>/` を作り、`Exhibit` インターフェース（`src/exhibits/types.ts`）を実装する
3. `src/exhibits/registry.ts` に登録し、`src/world/layout.ts` に配置する
4. 純粋関数の単体テストを書く。E2E の全作品巡回は registry から自動で対象になる

## コミット

- 機能・フェーズごとにコミットする。メッセージは英語の Conventional Commits（`feat:` `fix:` `test:` など）
