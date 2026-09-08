// テスト用の PDF を pdf-lib で組み立てる。
import { PDFDocument, PDFName, PDFString, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib';

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;

/**
 * 2 ページの PDF。
 * - 1 ページ目: 本文と Link 注釈（本アプリが触らない・件数にも数えない）
 * - 2 ページ目: /Rotate 90、Ink 注釈（触らないが件数に数える）
 */
export async function makeBasePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([PAGE_W, PAGE_H]);
  p1.drawText('The proposed method improves accuracy.', { x: 72, y: 720, size: 12, font, color: rgb(0, 0, 0) });
  const ctx = doc.context;
  const link = ctx.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [72, 700, 200, 714],
    Border: [0, 0, 0],
    A: { S: 'URI', URI: PDFString.of('https://example.org') },
  });
  p1.node.addAnnot(ctx.register(link));

  const p2 = doc.addPage([PAGE_W, PAGE_H]);
  p2.setRotation(degrees(90));
  p2.drawText('Rotated page.', { x: 100, y: 72, size: 12, font, rotate: degrees(90) });
  const ink = ctx.obj({
    Type: 'Annot',
    Subtype: 'Ink',
    Rect: [100, 100, 200, 200],
    InkList: [[100, 100, 150, 180, 200, 100]],
    C: [1, 0, 0],
    F: 4,
  });
  p2.node.addAnnot(ctx.register(ink));
  return doc.save();
}

/** Acrobat 以外のツールが書いたような、最小限のキーしか無い Highlight を 1 ページ目に足す。 */
export async function addBareHighlight(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  const annot = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Highlight',
    Rect: [72, 718, 300, 732],
    Contents: PDFString.of('bare'),
  });
  page.node.addAnnot(doc.context.register(annot));
  return doc.save();
}

/** 親の無い返信（IRT が存在しない参照を指す）を 1 ページ目に足す。 */
export async function addOrphanReply(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  const { PDFRef } = await import('@cantoo/pdf-lib');
  const annot = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [72, 600, 92, 620],
    Contents: PDFString.of('orphan'),
    T: PDFString.of('someone'),
    IRT: PDFRef.of(9999),
    RT: 'R',
  });
  page.node.addAnnot(doc.context.register(annot));
  return doc.save();
}

/** ページの Annots に並ぶ Subtype の一覧（pdf-lib で直接読む） */
export async function listSubtypes(bytes: Uint8Array, pageIndex: number): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(pageIndex);
  const annots = page.node.Annots();
  if (!annots) return [];
  const out: string[] = [];
  for (let i = 0; i < annots.size(); i++) {
    const dict = annots.lookup(i);
    if (dict && 'get' in dict) {
      const subtype = (dict as { get(name: unknown): unknown }).get(PDFName.of('Subtype'));
      out.push(subtype ? String(subtype).replace(/^\//, '') : '?');
    }
  }
  return out;
}
