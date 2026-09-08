import { describe, expect, it } from 'vitest';
import { hitTestHighlight } from '../src/viewer/hittest';
import { mkComment } from './helpers';

describe('hitTestHighlight', () => {
  const big = mkComment({ id: 'big', pageIndex: 0, anchor: { kind: 'highlight', quads: [[0, 0, 100, 100]] } });
  const small = mkComment({ id: 'small', pageIndex: 0, anchor: { kind: 'highlight', quads: [[40, 40, 60, 60]] } });
  const otherPage = mkComment({ id: 'p2', pageIndex: 1, anchor: { kind: 'highlight', quads: [[0, 0, 100, 100]] } });
  const note = mkComment({ id: 'note', pageIndex: 0, anchor: { kind: 'note', point: [50, 50] } });

  it('returns the highlight whose quad contains the point', () => {
    expect(hitTestHighlight([big], 0, [10, 10])?.id).toBe('big');
  });
  it('returns undefined when nothing is under the point or the page differs', () => {
    expect(hitTestHighlight([big], 0, [150, 150])).toBeUndefined();
    expect(hitTestHighlight([otherPage], 0, [10, 10])).toBeUndefined();
  });
  it('prefers the smallest containing highlight and ignores notes', () => {
    expect(hitTestHighlight([big, small, note], 0, [50, 50])?.id).toBe('small');
  });
});
