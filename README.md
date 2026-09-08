# lab-pdf-editor — 論文 PDF レビュー

ブラウザだけで論文 PDF にコメントを付け、**PDF 標準の注釈として埋め込んで**保存するツール。
大阪大学 OCEANS（先進海事システムデザイン共同研究講座）で、学生の原稿添削と複数人での原稿確認に使う。

A browser-only PDF review tool: highlight text or drop sticky notes, reply, and save the comments back into the PDF as standard annotations (visible in Acrobat, Preview, Zotero). Nothing is uploaded — the PDF never leaves the browser.

- 公開 URL: https://oceans-uosaka.github.io/lab-pdf-editor/ （GitHub Pages）
- リポジトリ: https://github.com/OCEANS-UOsaka/lab-pdf-editor

## できること

- 本文の文字列を選ぶ → **ハイライト＋コメント**。図など文字の無い場所には **付箋**。コメントには **返信** できる
- 著者名を記録し、**著者ごとに色分け**。複数人のコメントが混ざっても誰のものか分かる
- **コメント付き PDF を保存**（`元の名前_reviewed.pdf`）。コメントは PDF 標準注釈（Highlight / Text / Popup、返信は IRT）なので、Acrobat・macOS プレビュー・Zotero でもそのまま見える
- **他の人のコメントを取り込む**: 同じ原稿の注釈入り PDF を複数選ぶと、重複を除いて 1 つに統合される
- **Markdown 一覧**をクリップボードへコピー／`.md` で保存。ページ順に著者・引用・本文・返信が並ぶので Slack やメールに貼れる
- Acrobat やプレビューで付けた既存のハイライト・付箋も読み込んで編集できる
- **下書きはブラウザに自動保存**（IndexedDB）。リロードしても消えない。保存すると下書きは消える

## プライバシー

PDF はブラウザの中だけで処理され、**サーバへは一切送信されません**。公開されているのはこのツールのコードだけで、原稿は端末から出ません。
未公開の原稿をこのツールで扱っても、原稿がインターネット上に置かれることはありません。PDF の受け渡し自体は、いつも通り Slack・Box・メールで行ってください。

## 使い方

1. **PDF を開く** — ドラッグ＆ドロップか「PDF を開く」。初めてなら「サンプルで試す」
2. **著者名** を入れる（初回だけ。ブラウザが覚える）
3. **コメントする**
   - 文字列をドラッグして選ぶ → 「＋ コメント」を押す → 右のカードに本文を書く
   - 図や数式など文字の無い場所 → ツールバーの「付箋」（または `N` キー）を押してから、置きたい場所をクリック
   - 返信はカード下の入力欄に書いて Enter か「返信」
   - カードをクリックすると本文側がその場所へスクロールする。逆に本文のハイライト・付箋をクリックするとカードが選ばれる
4. **保存する** — 「コメント付き PDF を保存」または `⌘S` / `Ctrl+S`。`元の名前_reviewed.pdf` がダウンロードされる
5. **まとめる** — 複数人の注釈入り PDF を受け取ったら、1 つを開いて「コメントを取り込む」で残りを選ぶ。著者チップで表示の切替ができる。「Markdown ▾」で一覧を書き出す

キー操作: `⌘S`/`Ctrl+S` 保存 ・ `N` 付箋モード ・ `Esc` 付箋モード解除／選択解除

## 制限（v1）

- 文字層の無い PDF（スキャン画像）ではハイライトできない。付箋は使える
- パスワード付き PDF は開けない
- ページをまたいだ選択は、選択を始めたページの分だけがハイライトになる
- 読み込んだ既存注釈は「著者・日時・本文・座標・色」から作り直す。元の見た目（外観ストリーム）は引き継がない。ハイライト・付箋・返信以外の注釈（手描き・図形など）は表示しないが、保存時にそのまま保持する
- リアルタイムの同時編集はしない。共同レビューはファイルの受け渡し＋取り込みで行う

## 開発

前提: Node.js 22 以上。

```bash
npm ci
npm run dev        # http://localhost:5173/lab-pdf-editor/
npm run check      # typecheck + test + build
```

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバ（先に PDF.js の補助ファイルを `public/pdfjs/` へコピーする） |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest（`tests/`）。注釈の読み書きは実際に PDF を作って往復させる |
| `npm run build` | `dist/` を生成。GitHub Pages はここを配信する |
| `npm run sample` | 試用サンプル `public/sample/sample.pdf` を生成し直す |
| `node scripts/inspect-annotations.mjs <file.pdf>` | PDF の注釈を一覧する（デバッグ用） |

### 構成

```
src/
  model/    コメントのデータモデル・Store・統合（dedupe）・著者色      … 純粋ロジック・テスト対象
  pdf/      注釈の読み書き（@cantoo/pdf-lib）・PDF 日付・SHA-256・PDF.js の読み込み
  viewer/   PDF.js 描画・文字層・座標変換・選択・オーバーレイ・クリック判定
  ui/       ツールバー・サイドバー・空状態・通知（素の DOM）
  export/   Markdown・ファイル名・ダウンロード
  storage/  IndexedDB の下書き
tests/      Vitest。fixtures.ts が pdf-lib でテスト用 PDF を組み立てる
scripts/    サンプル生成・PDF.js 補助ファイルのコピー・注釈の一覧
docs/       設計書（superpowers/specs）・手動テスト手順（TESTING.md）
```

実行時の依存は `pdfjs-dist`（描画）と `@cantoo/pdf-lib`（注釈の読み書き）の 2 つだけ。UI フレームワークは使わない。

### ドキュメント

| 文書 | 内容 |
|---|---|
| [docs/superpowers/specs/2026-09-08-pdf-review-app-design.md](docs/superpowers/specs/2026-09-08-pdf-review-app-design.md) | 設計と実装計画（承認済み）。末尾に実装後の差分 |
| [docs/TESTING.md](docs/TESTING.md) | 手動テストの手順と実施記録。Acrobat / プレビュー互換の確認を含む |
| [CONTRIBUTING.md](CONTRIBUTING.md) | ブランチ・PR・CI・リリース・PDF.js 更新時の確認 |
| [CLAUDE.md](CLAUDE.md) | AI で作業するときの技術規約 |

## ライセンス

MIT © 2026 OCEANS-UOsaka
