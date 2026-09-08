// 画面上部の操作列。状態は持たず、押されたことを actions で通知する。
import type { ZoomMode } from '../viewer/PdfViewer';

export interface ToolbarActions {
  openFiles(files: FileList): void;
  openSample(): void;
  importFiles(files: FileList): void;
  savePdf(): void;
  copyMarkdown(): void;
  saveMarkdown(): void;
  setAuthor(name: string): void;
  setZoom(mode: ZoomMode): void;
  toggleNoteMode(): void;
}

const ZOOM_OPTIONS: { label: string; value: ZoomMode }[] = [
  { label: '幅に合わせる', value: 'fit-width' },
  { label: '75%', value: 75 },
  { label: '100%', value: 100 },
  { label: '125%', value: 125 },
  { label: '150%', value: 150 },
  { label: '200%', value: 200 },
];

export class Toolbar {
  readonly el: HTMLElement;
  private readonly fileInput: HTMLInputElement;
  private readonly importInput: HTMLInputElement;
  private readonly authorInput: HTMLInputElement;
  private readonly zoomSelect: HTMLSelectElement;
  private readonly noteButton: HTMLButtonElement;
  private readonly fileLabel: HTMLSpanElement;
  private readonly docButtons: HTMLButtonElement[] = [];

  constructor(parent: HTMLElement, actions: ToolbarActions) {
    this.el = document.createElement('header');
    this.el.className = 'tb';
    this.el.innerHTML = `
      <div class="tb-brand"><span class="tb-logo"></span>論文 PDF レビュー</div>
      <button type="button" class="tb-btn" data-act="open">PDF を開く</button>
      <button type="button" class="tb-btn tb-btn-quiet" data-act="sample">サンプルで試す</button>
      <span class="tb-file" data-role="file"></span>
      <div class="tb-spacer"></div>
      <label class="tb-author">著者名 <input type="text" data-role="author" placeholder="あなたの名前" autocomplete="name" /></label>
      <select class="tb-zoom" data-role="zoom" title="表示倍率"></select>
      <button type="button" class="tb-btn tb-toggle" data-act="note" data-doc title="ページをクリックした場所に付箋を置く（N）">付箋</button>
      <button type="button" class="tb-btn" data-act="import" data-doc title="同じ原稿の注釈入り PDF を選んでコメントを統合する">コメントを取り込む</button>
      <details class="tb-menu" data-role="md">
        <summary class="tb-btn" data-doc>Markdown ▾</summary>
        <div class="tb-menu-list">
          <button type="button" data-act="md-copy">クリップボードにコピー</button>
          <button type="button" data-act="md-save">.md ファイルを保存</button>
        </div>
      </details>
      <button type="button" class="tb-btn tb-btn-primary" data-act="save" data-doc title="コメントを PDF 注釈として埋め込んで保存（⌘S / Ctrl+S）">コメント付き PDF を保存</button>
      <input type="file" accept="application/pdf,.pdf" hidden data-role="file-input" />
      <input type="file" accept="application/pdf,.pdf" multiple hidden data-role="import-input" />
    `;
    parent.append(this.el);

    this.fileInput = this.query<HTMLInputElement>('[data-role="file-input"]');
    this.importInput = this.query<HTMLInputElement>('[data-role="import-input"]');
    this.authorInput = this.query<HTMLInputElement>('[data-role="author"]');
    this.zoomSelect = this.query<HTMLSelectElement>('[data-role="zoom"]');
    this.noteButton = this.query<HTMLButtonElement>('[data-act="note"]');
    this.fileLabel = this.query<HTMLSpanElement>('[data-role="file"]');
    this.docButtons = Array.from(this.el.querySelectorAll<HTMLButtonElement>('[data-doc]'));

    for (const opt of ZOOM_OPTIONS) {
      const option = document.createElement('option');
      option.value = String(opt.value);
      option.textContent = opt.label;
      this.zoomSelect.append(option);
    }

    this.el.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLElement>('[data-act]');
      if (!button) return;
      switch (button.dataset.act) {
        case 'open':
          this.fileInput.click();
          break;
        case 'sample':
          actions.openSample();
          break;
        case 'import':
          this.importInput.click();
          break;
        case 'note':
          actions.toggleNoteMode();
          break;
        case 'save':
          actions.savePdf();
          break;
        case 'md-copy':
          this.closeMenu();
          actions.copyMarkdown();
          break;
        case 'md-save':
          this.closeMenu();
          actions.saveMarkdown();
          break;
      }
    });
    this.fileInput.addEventListener('change', () => {
      if (this.fileInput.files?.length) actions.openFiles(this.fileInput.files);
      this.fileInput.value = '';
    });
    this.importInput.addEventListener('change', () => {
      if (this.importInput.files?.length) actions.importFiles(this.importInput.files);
      this.importInput.value = '';
    });
    this.authorInput.addEventListener('change', () => actions.setAuthor(this.authorInput.value));
    this.authorInput.addEventListener('blur', () => actions.setAuthor(this.authorInput.value));
    this.zoomSelect.addEventListener('change', () => {
      const value = this.zoomSelect.value;
      actions.setZoom(value === 'fit-width' ? 'fit-width' : Number(value));
    });
    this.setDocumentOpen(false);
  }

  private query<T extends Element>(selector: string): T {
    const el = this.el.querySelector<T>(selector);
    if (!el) throw new Error(`Toolbar: ${selector} が見つかりません`);
    return el;
  }

  private closeMenu(): void {
    this.query<HTMLDetailsElement>('[data-role="md"]').open = false;
  }

  setAuthor(name: string): void {
    if (this.authorInput.value !== name) this.authorInput.value = name;
  }

  focusAuthor(): void {
    this.authorInput.focus();
    this.authorInput.select();
  }

  setFile(fileName: string | null, pageCount: number): void {
    this.fileLabel.textContent = fileName ? `${fileName} · ${pageCount} ページ` : '';
    this.fileLabel.title = fileName ?? '';
    this.setDocumentOpen(fileName !== null);
  }

  setNoteMode(on: boolean): void {
    this.noteButton.classList.toggle('is-on', on);
    this.noteButton.setAttribute('aria-pressed', String(on));
  }

  setZoom(mode: ZoomMode): void {
    this.zoomSelect.value = String(mode);
  }

  private setDocumentOpen(open: boolean): void {
    for (const b of this.docButtons) b.toggleAttribute('disabled', !open);
    this.zoomSelect.toggleAttribute('disabled', !open);
  }
}
