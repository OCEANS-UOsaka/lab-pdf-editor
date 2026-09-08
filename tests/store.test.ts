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
