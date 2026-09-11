import { describe, expect, it } from 'vitest';
import { ReviewStore } from '../src/model/store';
import { colorForAuthor } from '../src/model/color';
import { mkComment } from './helpers';

function makeStore() {
  let tick = 0;
  const store = new ReviewStore({
    now: () => `2026-09-08T05:0${tick++}:00.000Z`,
    newId: () => `id-${tick}`,
  });
  store.setAuthor('脇田');
  store.openDocument({ fileName: 'draft.pdf', pageCount: 3, comments: [], foreignAnnotations: {} });
  return store;
}

describe('ReviewStore', () => {
  it('addHighlight creates a comment with the current author, author color, timestamps and empty text', () => {
    const store = makeStore();
    const c = store.addHighlight({ pageIndex: 1, quads: [[10, 20, 30, 40]], quote: 'abc' });
    expect(c.author).toBe('脇田');
    expect(c.color).toBe(colorForAuthor('脇田'));
    expect(c.text).toBe('');
    expect(c.quote).toBe('abc');
    expect(c.anchor).toEqual({ kind: 'highlight', quads: [[10, 20, 30, 40]] });
    expect(c.createdAt).toBe(c.modifiedAt);
    expect(store.comments).toHaveLength(1);
    expect(store.selectedId).toBe(c.id);
  });

  it('addNote creates a note anchor', () => {
    const store = makeStore();
    const c = store.addNote({ pageIndex: 0, point: [100, 700] });
    expect(c.anchor).toEqual({ kind: 'note', point: [100, 700] });
    expect(c.quote).toBeUndefined();
  });

  it('updateText changes text and modifiedAt but not createdAt', () => {
    const store = makeStore();
    const c = store.addNote({ pageIndex: 0, point: [100, 700] });
    const before = { createdAt: c.createdAt, modifiedAt: c.modifiedAt };
    store.updateText(c.id, '本文');
    const after = store.comments[0]!;
    expect(after.text).toBe('本文');
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.modifiedAt).not.toBe(before.modifiedAt);
  });

  it('removeComment deletes it and clears the selection', () => {
    const store = makeStore();
    const c = store.addNote({ pageIndex: 0, point: [100, 700] });
    store.removeComment(c.id);
    expect(store.comments).toHaveLength(0);
    expect(store.selectedId).toBeNull();
  });

  it('addReply appends a reply by the current author; removeReply removes it', () => {
    const store = makeStore();
    const c = store.addNote({ pageIndex: 0, point: [100, 700] });
    store.setAuthor('平田');
    const r = store.addReply(c.id, '了解です');
    expect(store.comments[0]!.replies).toEqual([r]);
    expect(r.author).toBe('平田');
    store.removeReply(c.id, r.id);
    expect(store.comments[0]!.replies).toEqual([]);
  });

  it('notifies subscribers and supports unsubscribe', () => {
    const store = makeStore();
    const events: string[] = [];
    const off = store.subscribe((e) => events.push(e.type));
    const c = store.addNote({ pageIndex: 0, point: [100, 700] });
    store.select(null);
    off();
    store.updateText(c.id, 'x');
    expect(events).toEqual(['comments', 'selection']);
  });

  it('updateText emits a text event carrying the id, not a comments event', () => {
    const store = makeStore();
    const c = store.addNote({ pageIndex: 0, point: [100, 700] });
    const events: unknown[] = [];
    store.subscribe((e) => events.push(e));
    store.updateText(c.id, 'x');
    expect(events).toEqual([{ type: 'text', id: c.id }]);
  });

  it('exposes comments sorted by page and position', () => {
    const store = makeStore();
    store.addNote({ pageIndex: 2, point: [100, 700] });
    store.addNote({ pageIndex: 0, point: [100, 500] });
    store.addNote({ pageIndex: 0, point: [100, 700] });
    expect(store.comments.map((c) => [c.pageIndex, c.anchor.kind === 'note' ? c.anchor.point[1] : 0])).toEqual([
      [0, 700],
      [0, 500],
      [2, 700],
    ]);
  });

  it('mergeFrom rejects a document with a different page count', () => {
    const store = makeStore();
    expect(() => store.mergeFrom({ pageCount: 2, comments: [mkComment()] })).toThrow(/ページ数/);
    expect(store.comments).toHaveLength(0);
  });

  it('mergeFrom adds new comments and reports counts', () => {
    const store = makeStore();
    const own = store.addNote({ pageIndex: 0, point: [100, 700] });
    const result = store.mergeFrom({ pageCount: 3, comments: [own, mkComment({ id: 'other', author: '平田' })] });
    expect(result).toEqual({ added: 1, skipped: 1 });
    expect(store.comments).toHaveLength(2);
  });

  it('lists distinct authors in display order', () => {
    const store = makeStore();
    store.addNote({ pageIndex: 0, point: [100, 700] });
    store.setAuthor('平田');
    store.addNote({ pageIndex: 0, point: [100, 600] });
    store.addNote({ pageIndex: 0, point: [100, 500] });
    expect(store.authors()).toEqual(['脇田', '平田']);
  });
});

describe('ReviewStore の元に戻す／やり直す', () => {
  it('コメントの追加を取り消し、やり直せる', () => {
    const store = makeStore();
    const c = store.addNote({ pageIndex: 0, point: [100, 700] });
    expect(store.canUndo).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.comments).toHaveLength(0);
    expect(store.canUndo).toBe(false);
    expect(store.redo()).toBe(true);
    expect(store.comments.map((x) => x.id)).toEqual([c.id]);
  });

  it('削除を取り消すとコメントと選択が戻る', () => {
    const store = makeStore();
    const c = store.addNote({ pageIndex: 0, point: [100, 700] });
    store.updateText(c.id, '本文');
    store.removeComment(c.id);
    expect(store.selectedId).toBeNull();
    store.undo();
    expect(store.comments.map((x) => [x.id, x.text])).toEqual([[c.id, '本文']]);
    expect(store.selectedId).toBe(c.id);
  });

  it('同じコメントへの連続した本文編集は 1 手にまとめる', () => {
    const store = makeStore();
    const c = store.addNote({ pageIndex: 0, point: [100, 700] });
    store.updateText(c.id, 'あ');
    store.updateText(c.id, 'あい');
    store.updateText(c.id, 'あいう');
    store.undo();
    expect(store.comments[0]!.text).toBe('');
    store.redo();
    expect(store.comments[0]!.text).toBe('あいう');
  });

  it('別のコメントの本文編集は別の手として数える', () => {
    const store = makeStore();
    const a = store.addNote({ pageIndex: 0, point: [100, 700] });
    const b = store.addNote({ pageIndex: 0, point: [100, 600] });
    store.updateText(a.id, 'A');
    store.updateText(b.id, 'B');
    store.undo();
    expect(store.find(b.id)!.text).toBe('');
    expect(store.find(a.id)!.text).toBe('A');
    store.undo();
    expect(store.find(a.id)!.text).toBe('');
  });

  it('返信の追加・削除と取り込みも取り消せる', () => {
    const store = makeStore();
    const c = store.addNote({ pageIndex: 0, point: [100, 700] });
    const r = store.addReply(c.id, '了解です');
    store.undo();
    expect(store.find(c.id)!.replies).toEqual([]);
    store.redo();
    expect(store.find(c.id)!.replies.map((x) => x.id)).toEqual([r.id]);
    store.removeReply(c.id, r.id);
    store.undo();
    expect(store.find(c.id)!.replies.map((x) => x.id)).toEqual([r.id]);

    store.mergeFrom({ pageCount: 3, comments: [mkComment({ id: 'other', author: '平田' })] });
    expect(store.comments).toHaveLength(2);
    store.undo();
    expect(store.comments).toHaveLength(1);
  });

  it('戻せるのは 5 手まで', () => {
    const store = makeStore();
    for (let i = 0; i < 7; i += 1) store.addNote({ pageIndex: 0, point: [100, 700 - i] });
    let steps = 0;
    while (store.undo()) steps += 1;
    expect(steps).toBe(5);
    expect(store.comments).toHaveLength(2);
  });

  it('取り消した後に別の操作をすると、やり直しはできなくなる', () => {
    const store = makeStore();
    store.addNote({ pageIndex: 0, point: [100, 700] });
    store.undo();
    expect(store.canRedo).toBe(true);
    store.addNote({ pageIndex: 0, point: [100, 600] });
    expect(store.canRedo).toBe(false);
    expect(store.redo()).toBe(false);
  });

  it('戻せる操作が無ければ false を返し、状態を変えない', () => {
    const store = makeStore();
    expect(store.undo()).toBe(false);
    expect(store.redo()).toBe(false);
    expect(store.comments).toHaveLength(0);
  });

  it('文書を開き直すと履歴は消える', () => {
    const store = makeStore();
    store.addNote({ pageIndex: 0, point: [100, 700] });
    store.openDocument({ fileName: 'other.pdf', pageCount: 3, comments: [], foreignAnnotations: {} });
    expect(store.canUndo).toBe(false);
    expect(store.undo()).toBe(false);
    store.closeDocument();
    expect(store.canUndo).toBe(false);
  });

  it('取り消し・やり直しは comments イベントを流す', () => {
    const store = makeStore();
    store.addNote({ pageIndex: 0, point: [100, 700] });
    const events: string[] = [];
    store.subscribe((e) => events.push(e.type));
    store.undo();
    store.redo();
    expect(events).toEqual(['comments', 'comments']);
  });

  it('履歴に積んだ状態は現在の状態と切り離されている', () => {
    const store = makeStore();
    const c = store.addNote({ pageIndex: 0, point: [100, 700] });
    store.updateText(c.id, '一');
    store.addReply(c.id, '返信');
    store.undo(); // 返信の追加を取り消す
    store.updateText(c.id, '二'); // 取り消し後に編集しても、やり直し用の記録は汚れない
    store.undo();
    expect(store.find(c.id)!.text).toBe('一');
    expect(store.find(c.id)!.replies).toEqual([]);
  });
});
