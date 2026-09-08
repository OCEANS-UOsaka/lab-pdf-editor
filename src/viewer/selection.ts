// 文字選択を監視し、選択範囲を PDF ユーザ空間の矩形に変換する。
import type { Rect } from '../model/types';
import { clientRectsToPdfRects } from './coords';
import type { PageView } from './PageView';

export interface TextSelection {
  pageIndex: number;
  quads: Rect[];
  quote: string;
  /** 選択範囲の最後の矩形（ボタンを置く位置の目安・client 座標） */
  lastRect: DOMRect;
}

/**
 * container 内の文字選択が確定するたびに onChange を呼ぶ（選択が無くなれば null）。
 * ページをまたぐ選択は、選択が始まったページの分だけを採用する。
 */
export function watchTextSelection(
  container: HTMLElement,
  pageViewFor: (el: Element) => PageView | undefined,
  onChange: (selection: TextSelection | null) => void,
): () => void {
  const evaluate = (): void => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return onChange(null);
    const range = sel.getRangeAt(0);
    const startNode = range.startContainer;
    const startEl = startNode instanceof Element ? startNode : startNode.parentElement;
    if (!startEl || !container.contains(startEl)) return onChange(null);
    const pageView = pageViewFor(startEl);
    if (!pageView) return onChange(null);

    // 原点はページ要素。文字層は回転ページで CSS 回転されるので、その矩形を原点に使わない
    const pageRect = pageView.el.getBoundingClientRect();
    const tolerance = 1;
    const rects = Array.from(range.getClientRects()).filter(
      (r) =>
        r.width > 0 &&
        r.height > 0 &&
        r.left >= pageRect.left - tolerance &&
        r.right <= pageRect.right + tolerance &&
        r.top >= pageRect.top - tolerance &&
        r.bottom <= pageRect.bottom + tolerance,
    );
    const quads = clientRectsToPdfRects(rects, { left: pageRect.left, top: pageRect.top }, pageView.viewport);
    if (quads.length === 0) return onChange(null);
    const lastRect = rects[rects.length - 1] as DOMRect;
    onChange({ pageIndex: pageView.pageIndex, quads, quote: sel.toString().replace(/\s+/g, ' ').trim(), lastRect });
  };

  const onMouseUp = (): void => {
    window.setTimeout(evaluate, 0);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.shiftKey || event.key === 'Shift') evaluate();
  };
  const onSelectionChange = (): void => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed) onChange(null);
  };
  container.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('selectionchange', onSelectionChange);
  return () => {
    container.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('selectionchange', onSelectionChange);
  };
}
