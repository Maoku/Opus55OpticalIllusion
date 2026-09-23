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
- `E2E_BROWSERS=1 npm run e2e` でインストール済みの Chrome / Edge でも主要な E2E を回す
- E2E はフレームレートが低い（10〜20fps）ので、時間ではなく状態を待つ（`expect.poll`、`waitForMode`）
- ポインタロック中は DOM のボタンを押せない。E2E で HUD のボタンを使うときは、先に `document.exitPointerLock()` で一時停止にするか、キー操作を使う
- `window.__OIM__`（`src/app/debugApi.ts`）: 開発・E2E ビルドだけにある操作 API。`openExhibit` `debugPoints` `readPixel` `countRedPixels` `lookFrom` など

## URL パラメータ

- `?exhibit=<id>` その作品の鑑賞モードを直接開く
- `?quality=low|medium|high` 画質を指定する
- `?debug` stats.js と lil-gui を表示する（開発ビルドのみ）。作品は `tunables` で調整値を公開できる

## ディレクトリ規約

- `src/app` 初期化・メインループ・状態（`store.ts`）・保存（`persistence.ts`）・テスト用 API（`debugApi.ts`）
- `src/core` レンダラ・入力などの基盤
- `src/world` 建築。`layout.ts` が部屋・壁・展示配置の唯一の宣言的データ
- `src/player` 移動とカメラ
- `src/exhibits` 展示。`<番号>-<id>/` に 1 作品ずつ置く（例: `a1-cafe-wall/`）
  - `common/`: `BaseExhibit`（デモの中断・復元）、`FlatArtExhibit`（額装の平面作品）、`viewpoint.ts`（視点合わせの数学）、`ProjectorMaterial`（射影テクスチャ）、額縁・キャプション・床マーク
- `src/content/exhibits.ja.ts` 作品の文言（タイトル・鑑賞のしかた・ヒント）
- `src/ui` DOM の UI（フレームワークなし）
- `tests/unit` 純粋関数の単体テスト / `tests/e2e` Playwright

## コーディング規約

- 1 ユニット = 1m、目の高さ 1.6m、Y 軸が上
- 作品面は `MeshBasicMaterial` ＋ `toneMapped: false`、テクスチャは `SRGBColorSpace`（計画書 §4.6）
- 図形の計算（純粋関数、`pattern.ts` など）と Canvas への描画・3D 化（`index.ts`）を分け、前者を単体テストする
- 文言は `content/exhibits.ja.ts` に集約する。`howToView` に見え方（ネタバレ）を書かない
- 既存の有名作品の画像や形状は複製しない。原理に基づいて独自に作図する
- UI はキーボードで操作でき、ボタンには適切な `aria-*` をつける。文字のコントラスト比は 4.5:1 以上（`tests/unit/contrast.test.ts`）
- 展示のコンストラクタでは DOM に触れない（重い処理と Canvas は `init` → `build` で行う）。単体テストで全展示を生成している
- デモは `demo(signal)` で書き、`animate` / `wait` / `ctx.rig.flyTo` の戻り値が false なら中断として終える。元に戻す処理は `resetDemo` に書く
- 性能予算（計画書 §10）: 描画コール 250 以下、三角形 50 万以下、JS 500KB（gzip）以下。遠い展示は `ExhibitManager` が描画しない

## 展示を追加する手順

1. `src/content/exhibits.ja.ts` に文言を追加する（`ExhibitId` に ID を足す）
2. `src/exhibits/<番号>-<id>/` を作り、`Exhibit` インターフェース（`src/exhibits/types.ts`）を実装する
3. `src/exhibits/registry.ts` に登録し、`src/world/layout.ts` に配置する
4. 純粋関数の単体テストを書く。E2E の全作品巡回は registry から自動で対象になる

## 公開

- `.github/workflows/deploy.yml` が GitHub Pages に公開する。`VITE_SITE_URL`（`.env` は空）で OGP 画像を絶対 URL にする
- `public/og.png` は E-1 の推奨視点のスクリーンショット

## コミット

- 機能・フェーズごとにコミットする。メッセージは英語の Conventional Commits（`feat:` `fix:` `test:` など）
