# コントリビューションガイド

## 開発フロー

ブランチ運用は研究室の他リポジトリと同じ `feature/*` → `develop` → `main` の 3 段階。

```
feature/xxx ──PR──▶ develop ──PR（リリース）──▶ main ──GitHub Actions──▶ GitHub Pages
```

| 手順 | 内容 |
|---|---|
| 1 | `develop` から `feature/短い説明` を切る |
| 2 | 変更し、`npm run check` を通す |
| 3 | `develop` を base に Pull Request を作る（CI が typecheck / test / build を回す） |
| 4 | レビュー後にマージ |
| 5 | リリースは `develop` → `main` の PR。`main` に入ると `deploy.yml` が Pages へ配信する |

`develop` と `main` への直接 push はしない。

## コミット・PR

- コミットメッセージは 1 行目に変更内容を簡潔に（日本語可）。例: `回転ページで文字層がずれる問題を直す`
- PR には「何を・なぜ」と、手で確かめたことを書く（`docs/TESTING.md` のどの項目を通したか）
- 動作が変わる修正には必ずテストを足す。注釈の読み書きに触る変更は `tests/annotations.test.ts` の往復テストを更新する

## テスト方針

- ロジック（`src/model`・`src/pdf`・`src/export`・`src/viewer/coords.ts`・`hittest.ts`）は Vitest で固定する。テストを先に書き、失敗を見てから実装する
- 注釈の読み書きは pdf-lib で実際に PDF を組み立てて往復させる。PDF.js（Node）で読めることも確認する（別ライブラリでも読める担保）
- DOM（`src/ui`・`src/viewer` の描画部分）はブラウザで手動確認する。手順と記録は `docs/TESTING.md`

## PDF.js（pdfjs-dist）を更新するとき

PDF.js はメジャー更新で描画まわりの API が変わる。更新したら次を確認する。

1. `npm run check` が通る（型で拾える差分はここで出る。6.x では `convertToViewportRectangle` 削除・`render()` の `canvas` 必須が該当した）
2. `src/viewer/PageView.ts` の CSS 変数（`--scale-factor` `--user-unit` `--total-scale-factor` `--scale-round-x/y`）が `node_modules/pdfjs-dist/web/pdf_viewer.css` の `.pdfViewer .page` の定義と揃っている
3. ブラウザで **回転ページ（サンプル 3 ページ目）** を選択し、ハイライトが文字に乗る
4. `docs/TESTING.md` の手順を一通り回す

## ローカルで動かす

```bash
npm ci
npm run dev      # http://localhost:5173/lab-pdf-editor/
```

`npm run dev` / `npm run build` の前に `scripts/copy-pdfjs-assets.mjs` が PDF.js の補助ファイルを `public/pdfjs/` にコピーする（git 管理外）。
