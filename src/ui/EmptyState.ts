// PDF を開く前の画面。ドロップ先と使い方、プライバシーの明記。
export function renderEmptyState(parent: HTMLElement, actions: { openSample(): void; pickFile(): void }): HTMLElement {
  const el = document.createElement('div');
  el.className = 'empty';
  el.innerHTML = `
    <div class="empty-card">
      <h1>論文 PDF にコメントを付ける</h1>
      <p class="empty-lead">PDF をここにドロップ、または <button type="button" class="link" data-act="pick">ファイルを選ぶ</button>。
        初めての方は <button type="button" class="link" data-act="sample">サンプルで試す</button>。</p>
      <ol class="empty-steps">
        <li><b>選んでコメント</b> — 本文の文字列をドラッグして「＋ コメント」。図には「付箋」。</li>
        <li><b>保存して渡す</b> — 「コメント付き PDF を保存」。コメントは PDF 標準の注釈として埋め込まれ、Acrobat・プレビュー・Zotero でもそのまま見えます。</li>
        <li><b>まとめる</b> — 複数人の注釈入り PDF を「コメントを取り込む」で 1 つに統合。Markdown で一覧を Slack やメールへ。</li>
      </ol>
      <p class="empty-privacy">PDF はこのブラウザの中だけで処理され、サーバへは送信されません。下書きはこの端末のブラウザに自動保存されます。</p>
    </div>
  `;
  el.addEventListener('click', (event) => {
    const act = (event.target as Element).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'pick') actions.pickFile();
    if (act === 'sample') actions.openSample();
  });
  parent.append(el);
  return el;
}
