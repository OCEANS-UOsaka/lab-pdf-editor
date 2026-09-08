// クリック位置（PDF ユーザ空間）にあるハイライトを探す。重なっていれば小さい方（内側）を返す。
import type { Comment } from '../model/types';

export function hitTestHighlight(comments: readonly Comment[], pageIndex: number, [x, y]: [number, number]): Comment | undefined {
  let best: Comment | undefined;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const c of comments) {
    if (c.pageIndex !== pageIndex || c.anchor.kind !== 'highlight') continue;
    for (const [llx, lly, urx, ury] of c.anchor.quads) {
      if (x < llx || x > urx || y < lly || y > ury) continue;
      const area = (urx - llx) * (ury - lly);
      if (area < bestArea) {
        bestArea = area;
        best = c;
      }
    }
  }
  return best;
}
