// アプリの状態: 開いている文書・コメント・選択・著者名。変更は購読者に通知する。
import { colorForAuthor } from './color';
import { mergeComments, sortComments } from './merge';
import { UNKNOWN_AUTHOR, type Anchor, type Comment, type Rect, type Reply, type ReviewDoc } from './types';

export type StoreEvent =
  | { type: 'document' }
  /** コメントの追加・削除・返信・統合（一覧の作り直しが要る変更） */
  | { type: 'comments' }
  /** 本文の編集だけ（入力中に一覧を作り直すと入力欄のフォーカスが飛ぶので区別する） */
  | { type: 'text'; id: string }
  | { type: 'selection' }
  | { type: 'author' };
type Listener = (event: StoreEvent) => void;

interface StoreDeps {
  /** 現在時刻（ISO 8601）。テストで差し替える */
  now?: () => string;
  /** id 生成。テストで差し替える */
  newId?: () => string;
}

export class ReviewStore {
  private readonly now: () => string;
  private readonly newId: () => string;
  private readonly listeners = new Set<Listener>();
  private currentDoc: ReviewDoc | null = null;
  private currentSelectedId: string | null = null;
  private currentAuthor = '';

  constructor(deps: StoreDeps = {}) {
    this.now = deps.now ?? (() => new Date().toISOString());
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  get doc(): ReviewDoc | null {
    return this.currentDoc;
  }
  get selectedId(): string | null {
    return this.currentSelectedId;
  }
  get author(): string {
    return this.currentAuthor;
  }
  /** ページ順・上から順に並べたコメント（コピー） */
  get comments(): Comment[] {
    return this.currentDoc ? sortComments(this.currentDoc.comments) : [];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(type: Exclude<StoreEvent, { id: string }>['type']): void {
    this.dispatch({ type } as StoreEvent);
  }

  private dispatch(event: StoreEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  openDocument(doc: ReviewDoc): void {
    this.currentDoc = doc;
    this.currentSelectedId = null;
    this.emit('document');
  }

  closeDocument(): void {
    this.currentDoc = null;
    this.currentSelectedId = null;
    this.emit('document');
  }

  setAuthor(name: string): void {
    const trimmed = name.trim();
    if (trimmed === this.currentAuthor) return;
    this.currentAuthor = trimmed;
    this.emit('author');
  }

  select(id: string | null): void {
    if (id === this.currentSelectedId) return;
    this.currentSelectedId = id;
    this.emit('selection');
  }

  find(id: string): Comment | undefined {
    return this.currentDoc?.comments.find((c) => c.id === id);
  }

  /** 表示順で並べた重複なしの著者名 */
  authors(): string[] {
    const out: string[] = [];
    for (const c of this.comments) if (!out.includes(c.author)) out.push(c.author);
    return out;
  }

  addHighlight(input: { pageIndex: number; quads: Rect[]; quote?: string }): Comment {
    const c = this.newComment(input.pageIndex, { kind: 'highlight', quads: input.quads });
    if (input.quote && input.quote.trim()) c.quote = input.quote;
    this.insert(c);
    return c;
  }

  addNote(input: { pageIndex: number; point: [number, number] }): Comment {
    const c = this.newComment(input.pageIndex, { kind: 'note', point: input.point });
    this.insert(c);
    return c;
  }

  updateText(id: string, text: string): void {
    const c = this.find(id);
    if (!c || c.text === text) return;
    c.text = text;
    c.modifiedAt = this.now();
    this.dispatch({ type: 'text', id });
  }

  removeComment(id: string): void {
    const doc = this.requireDoc();
    const index = doc.comments.findIndex((c) => c.id === id);
    if (index < 0) return;
    doc.comments.splice(index, 1);
    if (this.currentSelectedId === id) this.currentSelectedId = null;
    this.emit('comments');
  }

  addReply(commentId: string, text: string): Reply {
    const c = this.find(commentId);
    if (!c) throw new Error(`コメントが見つかりません: ${commentId}`);
    const at = this.now();
    const reply: Reply = { id: this.newId(), author: this.authorOrUnknown(), text, createdAt: at, modifiedAt: at };
    c.replies.push(reply);
    this.emit('comments');
    return reply;
  }

  removeReply(commentId: string, replyId: string): void {
    const c = this.find(commentId);
    if (!c) return;
    const index = c.replies.findIndex((r) => r.id === replyId);
    if (index < 0) return;
    c.replies.splice(index, 1);
    this.emit('comments');
  }

  /** 別コピーのコメントを統合する。ページ数が違えば拒否する。 */
  mergeFrom(source: { pageCount: number; comments: readonly Comment[] }): { added: number; skipped: number } {
    const doc = this.requireDoc();
    if (source.pageCount !== doc.pageCount) {
      throw new Error(`ページ数が違います（この PDF は ${doc.pageCount} ページ、取り込み元は ${source.pageCount} ページ）`);
    }
    const result = mergeComments(doc.comments, source.comments);
    doc.comments = result.merged;
    this.emit('comments');
    return { added: result.added, skipped: result.skipped };
  }

  private authorOrUnknown(): string {
    return this.currentAuthor || UNKNOWN_AUTHOR;
  }

  private newComment(pageIndex: number, anchor: Anchor): Comment {
    const at = this.now();
    const author = this.authorOrUnknown();
    return {
      id: this.newId(),
      pageIndex,
      anchor,
      text: '',
      author,
      color: colorForAuthor(author),
      createdAt: at,
      modifiedAt: at,
      replies: [],
    };
  }

  private insert(c: Comment): void {
    this.requireDoc().comments.push(c);
    this.currentSelectedId = c.id;
    this.emit('comments');
  }

  private requireDoc(): ReviewDoc {
    if (!this.currentDoc) throw new Error('PDF が開かれていません');
    return this.currentDoc;
  }
}
