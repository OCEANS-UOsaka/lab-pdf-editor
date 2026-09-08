import { describe, expect, it } from 'vitest';
import { clientRectsToPdfRects, mergeLineRects, pdfRectToCss, type ViewportLike } from '../src/viewer/coords';

// scale 2・A4 縦（高さ 842pt）・回転なしの viewport を模した最小実装
const PAGE_H = 842;
const viewport: ViewportLike = {
  convertToPdfPoint: (x, y) => [x / 2, PAGE_H - y / 2],
  convertToViewportPoint: (x, y) => [x * 2, (PAGE_H - y) * 2],
};

describe('clientRectsToPdfRects', () => {
  it('converts a client rect to a PDF rect using the page origin and viewport', () => {
    const rects = clientRectsToPdfRects([{ left: 110, top: 60, width: 100, height: 20 }], { left: 10, top: 20 }, viewport);
    expect(rects).toEqual([[50, 812, 100, 822]]);
  });

  it('drops empty rects', () => {
    const rects = clientRectsToPdfRects([{ left: 110, top: 60, width: 0, height: 20 }], { left: 10, top: 20 }, viewport);
    expect(rects).toEqual([]);
  });

  it('merges fragments of the same line', () => {
    const rects = clientRectsToPdfRects(
      [
        { left: 110, top: 60, width: 100, height: 20 },
        { left: 211, top: 60, width: 99, height: 20 },
        { left: 110, top: 100, width: 50, height: 20 },
      ],
      { left: 10, top: 20 },
      viewport,
    );
    expect(rects).toEqual([
      [50, 812, 150, 822],
      [50, 792, 75, 802],
    ]);
  });
});

describe('mergeLineRects', () => {
  it('keeps rects on different lines apart, upper line first', () => {
    expect(mergeLineRects([[0, 0, 10, 10], [0, 20, 10, 30]])).toEqual([[0, 20, 10, 30], [0, 0, 10, 10]]);
  });
  it('unions overlapping rects on one line', () => {
    expect(mergeLineRects([[0, 0, 10, 10], [5, 1, 20, 9]])).toEqual([[0, 0, 20, 10]]);
  });
});

describe('pdfRectToCss', () => {
  it('returns normalized left/top/width/height in CSS pixels', () => {
    expect(pdfRectToCss([50, 812, 100, 822], viewport)).toEqual({ left: 100, top: 40, width: 100, height: 20 });
  });
});
