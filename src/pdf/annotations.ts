// PDF 標準注釈（Highlight / Text / Popup / 返信）とコメントモデルの相互変換。
// 読み取りも書き込みも pdf-lib だけで行う（PDF.js は描画専用）。
//
// 書き込みは「作り直し」方式: 既存の Highlight / Text / Popup を全て外し、モデルの内容で新規に書く。
// 削除・編集が確実に反映され、2 回保存しても重複しない。それ以外の Subtype は触らない。
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFString,
  type PDFContext,
  type PDFObject,
  type PDFPage,
} from '@cantoo/pdf-lib';
import { colorForAuthor, hexToRgb, rgbToHex, type Rgb } from '../model/color';
import { sortComments } from '../model/merge';
import { UNKNOWN_AUTHOR, type Anchor, type Comment, type Rect, type Reply } from '../model/types';
import { fromPdfDate, toPdfDate } from './pdfdate';

/** 本アプリが所有し、保存時に作り直す Subtype */
const MANAGED_SUBTYPES = new Set(['Highlight', 'Text', 'Popup']);
/** 「表示しない注釈」の件数に数えない Subtype（リンクやフォーム部品はコメントではない） */
const UNCOUNTED_SUBTYPES = new Set(['Link', 'Widget', 'Popup']);
const NOTE_ICON_SIZE = 20;
/** 本アプリ独自キー: ハイライトした文字列（PDF 標準にはこれを保持する場所が無い） */
const QUOTE_KEY = 'LPEQuote';

export interface ReadResult {
  pageCount: number;
  comments: Comment[];
  /** 触らない注釈の件数（Subtype → 件数） */
  foreignAnnotations: Record<string, number>;
}

async function load(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
}

// ---------- 読み取り ----------

export async function readAnnotations(bytes: Uint8Array): Promise<ReadResult> {
  const doc = await load(bytes);
  const pages = doc.getPages();
  const comments: Comment[] = [];
  const foreignAnnotations: Record<string, number> = {};

  pages.forEach((page, pageIndex) => {
    const parents = new Map<string, Comment>();
    const replies: { dict: PDFDict; subtype: string; parentKey: string }[] = [];

    for (const { ref, dict } of annotEntries(page)) {
      const subtype = nameOf(dict, 'Subtype');
      if (!subtype || subtype === 'Popup') continue;
      if (subtype === 'Highlight' || subtype === 'Text') {
        const irt = dict.get(PDFName.of('IRT'));
        if (irt instanceof PDFRef) {
          replies.push({ dict, subtype, parentKey: irt.toString() });
          continue;
        }
        const comment = toComment(dict, pageIndex, subtype);
        comments.push(comment);
        if (ref) parents.set(ref.toString(), comment);
        continue;
      }
      if (!UNCOUNTED_SUBTYPES.has(subtype)) foreignAnnotations[subtype] = (foreignAnnotations[subtype] ?? 0) + 1;
    }

    for (const { dict, subtype, parentKey } of replies) {
      const parent = parents.get(parentKey);
      if (parent) parent.replies.push(toReply(dict));
      else comments.push(toComment(dict, pageIndex, subtype)); // 親の無い返信は独立したコメントとして扱う
    }
  });

  return { pageCount: pages.length, comments, foreignAnnotations };
}

function annotEntries(page: PDFPage): { ref?: PDFRef; dict: PDFDict }[] {
  const annots = page.node.Annots();
  if (!annots) return [];
  const out: { ref?: PDFRef; dict: PDFDict }[] = [];
  for (let i = 0; i < annots.size(); i++) {
    const raw = annots.get(i);
    const ref = raw instanceof PDFRef ? raw : undefined;
    const dict = ref ? page.doc.context.lookup(ref) : raw;
    if (dict instanceof PDFDict) out.push(ref ? { ref, dict } : { dict });
  }
  return out;
}

function toComment(dict: PDFDict, pageIndex: number, subtype: string): Comment {
  const author = textOf(dict, 'T')?.trim() || UNKNOWN_AUTHOR;
  const rect = rectOf(dict) ?? [0, 0, 0, 0];
  const colorArr = numbersOf(dict, 'C');
  const createdAt = fromPdfDate(textOf(dict, 'CreationDate')) ?? fromPdfDate(textOf(dict, 'M')) ?? new Date().toISOString();
  const modifiedAt = fromPdfDate(textOf(dict, 'M')) ?? createdAt;
  const anchor: Anchor =
    subtype === 'Highlight'
      ? { kind: 'highlight', quads: quadsOf(dict) ?? [rect] }
      : { kind: 'note', point: [rect[0], rect[3]] };
  const comment: Comment = {
    id: textOf(dict, 'NM') || newId(),
    pageIndex,
    anchor,
    text: textOf(dict, 'Contents') ?? '',
    author,
    color: colorArr && colorArr.length === 3 ? rgbToHex(colorArr as Rgb) : colorForAuthor(author),
    createdAt,
    modifiedAt,
    replies: [],
  };
  const quote = subtype === 'Highlight' ? textOf(dict, QUOTE_KEY) : undefined;
  if (quote) comment.quote = quote;
  return comment;
}

function toReply(dict: PDFDict): Reply {
  const createdAt = fromPdfDate(textOf(dict, 'CreationDate')) ?? fromPdfDate(textOf(dict, 'M')) ?? new Date().toISOString();
  return {
    id: textOf(dict, 'NM') || newId(),
    author: textOf(dict, 'T')?.trim() || UNKNOWN_AUTHOR,
    text: textOf(dict, 'Contents') ?? '',
    createdAt,
    modifiedAt: fromPdfDate(textOf(dict, 'M')) ?? createdAt,
  };
}

function nameOf(dict: PDFDict, key: string): string | undefined {
  const v = dict.lookup(PDFName.of(key));
  return v instanceof PDFName ? v.decodeText() : undefined;
}

function textOf(dict: PDFDict, key: string): string | undefined {
  const v = dict.lookup(PDFName.of(key));
  if (v instanceof PDFHexString || v instanceof PDFString) {
    return v.decodeText().replace(/\r\n?/g, '\n').replace(/\0+$/, '');
  }
  return undefined;
}

function numbersOf(dict: PDFDict, key: string): number[] | undefined {
  const arr = dict.lookup(PDFName.of(key));
  if (!(arr instanceof PDFArray)) return undefined;
  const out: number[] = [];
  for (let i = 0; i < arr.size(); i++) {
    const n = arr.lookup(i);
    if (!(n instanceof PDFNumber)) return undefined;
    out.push(n.asNumber());
  }
  return out;
}

function rectOf(dict: PDFDict): Rect | undefined {
  const n = numbersOf(dict, 'Rect');
  if (!n || n.length !== 4) return undefined;
  const [x1, y1, x2, y2] = n as [number, number, number, number];
  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
}

/** QuadPoints（8 数値 = 1 四角形）を、軸に平行な矩形の列にする */
function quadsOf(dict: PDFDict): Rect[] | undefined {
  const n = numbersOf(dict, 'QuadPoints');
  if (!n || n.length === 0 || n.length % 8 !== 0) return undefined;
  const quads: Rect[] = [];
  for (let i = 0; i < n.length; i += 8) {
    const xs = [n[i], n[i + 2], n[i + 4], n[i + 6]] as number[];
    const ys = [n[i + 1], n[i + 3], n[i + 5], n[i + 7]] as number[];
    quads.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
  }
  return quads;
}

function newId(): string {
  return crypto.randomUUID();
}

// ---------- 書き込み ----------

export async function writeAnnotations(bytes: Uint8Array, comments: readonly Comment[]): Promise<Uint8Array> {
  const doc = await load(bytes);
  const ctx = doc.context;
  const pages = doc.getPages();
  for (const page of pages) removeManagedAnnotations(ctx, page);

  const byPage = new Map<number, Comment[]>();
  for (const c of comments) {
    const list = byPage.get(c.pageIndex) ?? [];
    list.push(c);
    byPage.set(c.pageIndex, list);
  }
  for (const [pageIndex, list] of byPage) {
    const page = pages[pageIndex];
    if (!page) continue; // ページ数を超えるコメントは書けない（取り込み時にページ数を照合して防ぐ）
    for (const c of sortComments(list)) appendComment(ctx, page, c);
  }
  return doc.save();
}

function removeManagedAnnotations(ctx: PDFContext, page: PDFPage): void {
  const annots = page.node.Annots();
  if (!annots) return;
  const kept: PDFObject[] = [];
  for (let i = 0; i < annots.size(); i++) {
    const raw = annots.get(i);
    const dict = raw instanceof PDFRef ? ctx.lookup(raw) : raw;
    const subtype = dict instanceof PDFDict ? nameOf(dict, 'Subtype') : undefined;
    if (subtype && MANAGED_SUBTYPES.has(subtype)) {
      if (raw instanceof PDFRef) ctx.delete(raw);
      continue;
    }
    kept.push(raw);
  }
  page.node.set(PDFName.of('Annots'), ctx.obj(kept));
}

function appendComment(ctx: PDFContext, page: PDFPage, c: Comment): void {
  const rect = anchorRect(c.anchor);
  const annotRef = ctx.nextRef();
  const popupRef = ctx.nextRef();
  const common = {
    Type: 'Annot',
    P: page.ref,
    Rect: rect,
    C: hexToRgb(c.color),
    CA: 1,
    T: PDFHexString.fromText(c.author),
    Contents: PDFHexString.fromText(c.text),
    NM: PDFHexString.fromText(c.id),
    M: PDFString.of(toPdfDate(c.modifiedAt)),
    CreationDate: PDFString.of(toPdfDate(c.createdAt)),
    Popup: popupRef,
  };
  const annot =
    c.anchor.kind === 'highlight'
      ? ctx.obj({
          ...common,
          Subtype: 'Highlight',
          F: 4, // Print
          QuadPoints: toQuadPoints(c.anchor.quads),
          Subj: PDFHexString.fromText('Highlight'),
          ...(c.quote ? { [QUOTE_KEY]: PDFHexString.fromText(c.quote) } : {}),
        })
      : ctx.obj({
          ...common,
          Subtype: 'Text',
          F: 28, // Print | NoZoom | NoRotate
          Name: 'Comment',
          Subj: PDFHexString.fromText('Note'),
        });
  ctx.assign(annotRef, annot);
  ctx.assign(
    popupRef,
    ctx.obj({ Type: 'Annot', Subtype: 'Popup', P: page.ref, Parent: annotRef, Rect: popupRect(page, rect), Open: false, F: 28 }),
  );
  page.node.addAnnot(annotRef);
  page.node.addAnnot(popupRef);

  for (const r of c.replies) {
    const reply = ctx.obj({
      Type: 'Annot',
      Subtype: 'Text',
      P: page.ref,
      Rect: rect,
      F: 28,
      Name: 'Comment',
      IRT: annotRef,
      RT: 'R',
      C: hexToRgb(colorForAuthor(r.author)),
      T: PDFHexString.fromText(r.author),
      Contents: PDFHexString.fromText(r.text),
      NM: PDFHexString.fromText(r.id),
      M: PDFString.of(toPdfDate(r.modifiedAt)),
      CreationDate: PDFString.of(toPdfDate(r.createdAt)),
    });
    page.node.addAnnot(ctx.register(reply));
  }
}

/** アンカーの外接矩形。付箋はアイコン 20×20pt（point を左上）。 */
export function anchorRect(anchor: Anchor): Rect {
  if (anchor.kind === 'note') {
    const [x, y] = anchor.point;
    return [x, y - NOTE_ICON_SIZE, x + NOTE_ICON_SIZE, y];
  }
  return [
    Math.min(...anchor.quads.map((q) => q[0])),
    Math.min(...anchor.quads.map((q) => q[1])),
    Math.max(...anchor.quads.map((q) => q[2])),
    Math.max(...anchor.quads.map((q) => q[3])),
  ];
}

/** 矩形 → QuadPoints。並びは Acrobat 互換（左上・右上・左下・右下）。 */
function toQuadPoints(quads: readonly Rect[]): number[] {
  return quads.flatMap(([llx, lly, urx, ury]) => [llx, ury, urx, ury, llx, lly, urx, lly]);
}

/** ポップアップの置き場所（ページ右端・アンカーの上端に合わせる）。多くのビューアは無視して自分で配置する。 */
function popupRect(page: PDFPage, anchor: Rect): Rect {
  const { width } = page.getSize();
  const top = anchor[3];
  const bottom = Math.max(0, top - 120);
  return [Math.max(0, width - 220), bottom, Math.max(200, width - 20), Math.max(top, bottom + 1)];
}
