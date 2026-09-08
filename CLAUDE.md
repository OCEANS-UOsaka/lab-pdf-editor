# CLAUDE.md

このリポジトリで AI（Claude Code）が作業するときの前提。手順の正典は各文書。

| 文書 | 役割 |
|---|---|
| [README.md](README.md) | 何のためのツールか・使い方・構成 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | ブランチ・PR・CI・リリース・PDF.js 更新時の確認（**作業手順の正典**） |
| [docs/superpowers/specs/2026-09-08-pdf-review-app-design.md](docs/superpowers/specs/2026-09-08-pdf-review-app-design.md) | 設計の正本。変えたら末尾「実装後の差分」に理由を書く |
| [docs/TESTING.md](docs/TESTING.md) | 手動テストの手順と実施記録 |

## 守ること

- **PDF をサーバへ送る機能を入れない**。ブラウザ内完結がこのツールの前提（README「プライバシー」）
- 実行時依存は `pdfjs-dist`（描画専用）と `@cantoo/pdf-lib`（注釈の読み書き専用）の 2 つ。役割を混ぜない。UI フレームワークは入れない
- コメントの幾何は **PDF ユーザ空間**で持つ。CSS 座標への変換は `src/viewer/coords.ts` に集める
- 注釈の書き出しは **作り直し**（既存の Highlight / Text / Popup を外して全部書く）。差分更新にしない
- Store のイベントは `comments`（一覧の作り直し）と `text`（本文編集のみ）を分ける。入力中に一覧を作り直すとフォーカスが飛ぶ
- ロジックの変更はテストを先に書く（`tests/`）。DOM の変更はブラウザで確かめ、`docs/TESTING.md` に記録する

## よく使うコマンド

```bash
npm run dev        # 開発サーバ http://localhost:5173/lab-pdf-editor/
npm run check      # typecheck + test + build
node scripts/inspect-annotations.mjs <file.pdf>   # PDF の注釈を一覧
```
