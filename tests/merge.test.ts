import { describe, expect, it } from 'vitest';
import { fingerprint, mergeComments, sortComments } from '../src/model/merge';
import { mkComment, mkReply } from './helpers';

describe('mergeComments', () => {
  it('keeps a comment with the same id once and unions replies by id', () => {
    const base = mkComment({ id: 'same', replies: [mkReply({ id: 'r-a' })] });
    const incoming = mkComment({ id: 'same', text: '別コピーで編集された本文', replies: [mkReply({ id: 'r-a' }), mkReply({ id: 'r-b' })] });
    const result = mergeComments([base], [incoming]);
    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].text).toBe(base.text);
    expect(result.merged[0].replies.map((r) => r.id)).toEqual(['r-a', 'r-b']);
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('treats identical page/kind/geometry/author/text as the same comment even with different ids', () => {
    const base = mkComment({ id: 'x' });
    const incoming = mkComment({ id: 'y' });
    const result = mergeComments([base], [incoming]);
    expect(result.merged).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });

  it('adds distinct incoming comments and reports counts', () => {
    const base = mkComment({ id: 'x' });
    const other = mkComment({ id: 'y', author: '平田', text: '別の指摘' });
    const result = mergeComments([base], [other, mkComment({ id: 'x' })]);
    expect(result.merged.map((c) => c.id)).toEqual(['x', 'y']);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
  });
});

describe('fingerprint', () => {
  it('ignores sub-half-point geometry noise but not larger moves', () => {
    const a = mkComment({ anchor: { kind: 'highlight', quads: [[100.2, 700, 300, 712]] } });
    const b = mkComment({ anchor: { kind: 'highlight', quads: [[100.4, 700, 300, 712]] } });
    const c = mkComment({ anchor: { kind: 'highlight', quads: [[101.0, 700, 300, 712]] } });
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(fingerprint(a)).not.toBe(fingerprint(c));
  });
  it('distinguishes a note from a highlight at the same place', () => {
    const h = mkComment({ anchor: { kind: 'highlight', quads: [[100, 700, 300, 712]] } });
    const n = mkComment({ anchor: { kind: 'note', point: [100, 712] } });
    expect(fingerprint(h)).not.toBe(fingerprint(n));
  });
});

describe('sortComments', () => {
  it('orders by page, then top edge descending, then left edge ascending', () => {
    const p2 = mkComment({ id: 'p2', pageIndex: 1 });
    const lower = mkComment({ id: 'lower', anchor: { kind: 'highlight', quads: [[100, 500, 300, 512]] } });
    const upperRight = mkComment({ id: 'upperRight', anchor: { kind: 'note', point: [400, 712] } });
    const upperLeft = mkComment({ id: 'upperLeft', anchor: { kind: 'highlight', quads: [[100, 700, 300, 712]] } });
    const sorted = sortComments([p2, lower, upperRight, upperLeft]);
    expect(sorted.map((c) => c.id)).toEqual(['upperLeft', 'upperRight', 'lower', 'p2']);
  });
  it('does not mutate the input', () => {
    const input = [mkComment({ pageIndex: 1 }), mkComment({ pageIndex: 0 })];
    const copy = [...input];
    sortComments(input);
    expect(input).toEqual(copy);
  });
});
