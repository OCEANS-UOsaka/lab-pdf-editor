// 右側のコメント一覧。Store を購読して描き直す。本文の編集中（text イベント）は作り直さない。
import type { ReviewStore } from '../model/store';
import type { Comment } from '../model/types';

export interface SidebarCallbacks {
  /** カードが押された（本文側をそこへスクロールさせたい） */
  onJump(comment: Comment): void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function autosize(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight + 2}px`;
}

export class Sidebar {
  readonly el: HTMLElement;
  private readonly listEl: HTMLDivElement;
  private readonly countEl: HTMLSpanElement;
  private readonly filterEl: HTMLDivElement;
  private readonly noticeEl: HTMLDivElement;
  private readonly emptyEl: HTMLDivElement;
  private hiddenAuthors = new Set<string>();
  private pendingFocusId: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly store: ReviewStore,
    private readonly callbacks: SidebarCallbacks,
  ) {
    this.el = document.createElement('aside');
    this.el.className = 'sb';
    this.el.innerHTML = `
      <div class="sb-head">
        <h2 class="sb-title">コメント <span class="sb-count" data-role="count">0</span></h2>
        <div class="sb-filters" data-role="filters"></div>
      </div>
      <div class="sb-notice" data-role="notice" hidden></div>
      <div class="sb-list" data-role="list"></div>
      <div class="sb-empty" data-role="empty">
        <p>まだコメントはありません。</p>
        <p>本文の文字列をドラッグして選ぶと「＋ コメント」が出ます。図など文字の無い場所には、ツールバーの「付箋」を押してからクリックしてください。</p>
      </div>
    `;
    parent.append(this.el);
    this.listEl = this.query('[data-role="list"]');
    this.countEl = this.query('[data-role="count"]');
    this.filterEl = this.query('[data-role="filters"]');
    this.noticeEl = this.query('[data-role="notice"]');
    this.emptyEl = this.query('[data-role="empty"]');

    store.subscribe((event) => {
      switch (event.type) {
        case 'document':
          this.hiddenAuthors.clear();
          this.render();
          break;
        case 'comments':
          this.render();
          break;
        case 'selection':
          this.applySelection();
          break;
        case 'text':
          this.refreshTime(event.id);
          break;
        case 'author':
          break;
      }
    });
    this.render();
  }

  private query<T extends Element>(selector: string): T {
    const el = this.el.querySelector<T>(selector);
    if (!el) throw new Error(`Sidebar: ${selector} が見つかりません`);
    return el;
  }

  /** 次の描画後にそのコメントの入力欄へフォーカスする（新規作成直後に使う） */
  focusComment(id: string): void {
    const textarea = this.listEl.querySelector<HTMLTextAreaElement>(`[data-id="${id}"] textarea`);
    if (textarea) {
      textarea.focus();
      this.scrollCardIntoView(id);
    } else {
      this.pendingFocusId = id;
    }
  }

  private render(): void {
    const doc = this.store.doc;
    const comments = this.store.comments;
    this.countEl.textContent = String(comments.length);
    this.renderFilters();
    this.renderNotice(doc?.foreignAnnotations ?? {});
    this.emptyEl.hidden = !doc || comments.length > 0;

    const fragment = document.createDocumentFragment();
    for (const c of comments) fragment.append(this.renderCard(c));
    this.listEl.replaceChildren(fragment);
    this.applySelection();

    if (this.pendingFocusId) {
      const id = this.pendingFocusId;
      this.pendingFocusId = null;
      this.focusComment(id);
    }
  }

  private renderFilters(): void {
    const authors = this.store.authors();
    this.filterEl.replaceChildren();
    if (authors.length < 2) {
      this.hiddenAuthors.clear();
      return;
    }
    for (const author of authors) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'sb-chip';
      chip.classList.toggle('is-off', this.hiddenAuthors.has(author));
      const color = this.store.comments.find((c) => c.author === author)?.color ?? '#999';
      chip.innerHTML = `<span class="sb-dot" style="background:${color}"></span>${escapeHtml(author)}`;
      chip.title = 'クリックで表示／非表示';
      chip.addEventListener('click', () => {
        if (this.hiddenAuthors.has(author)) this.hiddenAuthors.delete(author);
        else this.hiddenAuthors.add(author);
        this.render();
      });
      this.filterEl.append(chip);
    }
  }

  private renderNotice(foreign: Record<string, number>): void {
    const entries = Object.entries(foreign);
    const total = entries.reduce((sum, [, n]) => sum + n, 0);
    this.noticeEl.hidden = total === 0;
    if (total === 0) return;
    const detail = entries.map(([subtype, n]) => `${subtype} ${n}`).join(' / ');
    this.noticeEl.textContent = `この PDF には表示しない注釈が ${total} 件あります（${detail}）。保存時にそのまま保持します。`;
  }

  private renderCard(c: Comment): HTMLElement {
    const card = document.createElement('article');
    card.className = 'cc';
    card.dataset.id = c.id;
    card.hidden = this.hiddenAuthors.has(c.author);
    const kindLabel = c.anchor.kind === 'note' ? '付箋' : 'ハイライト';
    card.innerHTML = `
      <header class="cc-head">
        <span class="sb-dot" style="background:${c.color}"></span>
        <span class="cc-author">${escapeHtml(c.author)}</span>
        <span class="cc-meta">p.${c.pageIndex + 1} · ${kindLabel}</span>
        <time class="cc-time" data-role="time">${formatTime(c.modifiedAt)}</time>
        <button type="button" class="cc-icon" data-act="delete" title="このコメントを削除">✕</button>
      </header>
      ${c.anchor.kind === 'highlight' && c.quote ? `<blockquote class="cc-quote">${escapeHtml(c.quote)}</blockquote>` : ''}
      <textarea class="cc-text" rows="2" placeholder="コメントを入力">${escapeHtml(c.text)}</textarea>
      <ul class="cc-replies">
        ${c.replies
          .map(
            (r) => `<li data-reply-id="${r.id}"><span class="cc-reply-author">${escapeHtml(r.author)}</span> ${escapeHtml(r.text)}
              <button type="button" class="cc-icon cc-icon-small" data-act="delete-reply" title="返信を削除">✕</button></li>`,
          )
          .join('')}
      </ul>
      <form class="cc-reply-form"><input type="text" placeholder="返信…" /><button type="submit" class="tb-btn tb-btn-quiet">返信</button></form>
    `;

    const textarea = card.querySelector<HTMLTextAreaElement>('textarea')!;
    textarea.addEventListener('input', () => {
      this.store.updateText(c.id, textarea.value);
      autosize(textarea);
    });
    textarea.addEventListener('focus', () => this.store.select(c.id));
    requestAnimationFrame(() => autosize(textarea));

    card.addEventListener('click', (event) => {
      const target = event.target as Element;
      const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'delete') {
        if (c.text.trim() === '' || window.confirm('このコメントを削除しますか？')) this.store.removeComment(c.id);
        return;
      }
      if (act === 'delete-reply') {
        const replyId = target.closest<HTMLElement>('[data-reply-id]')?.dataset.replyId;
        if (replyId) this.store.removeReply(c.id, replyId);
        return;
      }
      if (target.closest('form, textarea, button')) return;
      this.store.select(c.id);
      this.callbacks.onJump(c);
    });

    const form = card.querySelector<HTMLFormElement>('form')!;
    const replyInput = form.querySelector<HTMLInputElement>('input')!;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = replyInput.value.trim();
      if (!text) return;
      this.store.addReply(c.id, text);
      replyInput.value = '';
    });
    // Enter で送信する。日本語 IME の変換確定（isComposing）では送らない
    replyInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      event.preventDefault();
      form.requestSubmit();
    });
    return card;
  }

  private applySelection(): void {
    const selectedId = this.store.selectedId;
    for (const card of this.listEl.querySelectorAll<HTMLElement>('.cc')) {
      card.classList.toggle('is-selected', card.dataset.id === selectedId);
    }
    if (selectedId) this.scrollCardIntoView(selectedId);
  }

  private scrollCardIntoView(id: string): void {
    const card = this.listEl.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (!card) return;
    const listRect = this.listEl.getBoundingClientRect();
    const rect = card.getBoundingClientRect();
    if (rect.top < listRect.top || rect.bottom > listRect.bottom) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  private refreshTime(id: string): void {
    const c = this.store.find(id);
    const time = this.listEl.querySelector<HTMLElement>(`[data-id="${id}"] [data-role="time"]`);
    if (c && time) time.textContent = formatTime(c.modifiedAt);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
}
