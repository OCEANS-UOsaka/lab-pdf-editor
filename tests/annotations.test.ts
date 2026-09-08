import { describe, expect, it } from 'vitest';
import { readAnnotations, writeAnnotations } from '../src/pdf/annotations';
import { colorForAuthor } from '../src/model/color';
import type { Comment } from '../src/model/types';
import { mkComment, mkReply } from './helpers';
import { addBareHighlight, addOrphanReply, listSubtypes, makeBasePdf } from './fixtures';

const highlight: Comment = mkComment({
  id: '11111111-1111-4111-8111-111111111111',
  pageIndex: 0,
  anchor: { kind: 'highlight', quads: [[72, 718, 300, 732], [72, 702, 150, 716]] },
  quote: 'The proposed method improves accuracy.',
  text: 'ここは根拠が弱い。\n引用を足すこと。',
  author: '脇田',
  color: '#ffd54f',
  createdAt: '2026-09-08T05:00:00.000Z',
  modifiedAt: '2026-09-08T05:10:00.000Z',
  replies: [
    mkReply({ id: '22222222-2222-4222-8222-222222222222', author: '平田', text: '追記します。', createdAt: '2026-09-08T06:00:00.000Z', modifiedAt: '2026-09-08T06:00:00.000Z' }),
  ],
});

const note: Comment = mkComment({
  id: '33333333-3333-4333-8333-333333333333',
  pageIndex: 1,
  anchor: { kind: 'note', point: [120, 300] },
  quote: undefined,
  text: '図の軸ラベルが小さい',
  author: '平田',
  color: '#90caf9',
  replies: [],
});

describe('readAnnotations on a PDF without comments', () => {
  it('reports page count, no comments, and counts foreign markup (not Link)', async () => {
    const result = await readAnnotations(await makeBasePdf());
    expect(result.pageCount).toBe(2);
    expect(result.comments).toEqual([]);
    expect(result.foreignAnnotations).toEqual({ Ink: 1 });
  });
});

describe('write → read round trip', () => {
  it('restores highlight, note and reply with author, text, color, dates and geometry', async () => {
    const out = await writeAnnotations(await makeBasePdf(), [highlight, note]);
    const result = await readAnnotations(out);
    expect(result.comments).toHaveLength(2);
    const byId = new Map(result.comments.map((c) => [c.id, c]));

    const h = byId.get(highlight.id)!;
    expect(h.pageIndex).toBe(0);
    expect(h.anchor.kind).toBe('highlight');
    if (h.anchor.kind === 'highlight') {
      expect(h.anchor.quads).toHaveLength(2);
      h.anchor.quads.forEach((q, i) => q.forEach((v, j) => expect(v).toBeCloseTo(highlight.anchor.kind === 'highlight' ? highlight.anchor.quads[i]![j]! : NaN, 3)));
    }
    expect(h.quote).toBe(highlight.quote);
    expect(h.text).toBe(highlight.text);
    expect(h.author).toBe('脇田');
    expect(h.color).toBe('#ffd54f');
    expect(h.createdAt).toBe(highlight.createdAt);
    expect(h.modifiedAt).toBe(highlight.modifiedAt);
    expect(h.replies).toEqual(highlight.replies);

    const n = byId.get(note.id)!;
    expect(n.pageIndex).toBe(1);
    expect(n.anchor).toEqual({ kind: 'note', point: [120, 300] });
    expect(n.quote).toBeUndefined();
    expect(n.text).toBe(note.text);
    expect(n.author).toBe('平田');
    expect(n.color).toBe('#90caf9');
  });

  it('keeps foreign annotations (Link, Ink) untouched', async () => {
    const out = await writeAnnotations(await makeBasePdf(), [highlight, note]);
    expect(await listSubtypes(out, 0)).toEqual(['Link', 'Highlight', 'Popup', 'Text']);
    expect(await listSubtypes(out, 1)).toEqual(['Ink', 'Text', 'Popup']);
    expect((await readAnnotations(out)).foreignAnnotations).toEqual({ Ink: 1 });
  });

  it('does not duplicate comments when the same set is written again', async () => {
    const once = await writeAnnotations(await makeBasePdf(), [highlight, note]);
    const twice = await writeAnnotations(once, [highlight, note]);
    expect((await readAnnotations(twice)).comments).toHaveLength(2);
    expect(await listSubtypes(twice, 0)).toEqual(['Link', 'Highlight', 'Popup', 'Text']);
  });

  it('drops comments that were removed from the model', async () => {
    const once = await writeAnnotations(await makeBasePdf(), [highlight, note]);
    const fewer = await writeAnnotations(once, [note]);
    const result = await readAnnotations(fewer);
    expect(result.comments.map((c) => c.id)).toEqual([note.id]);
    expect(await listSubtypes(fewer, 0)).toEqual(['Link']);
  });
});

describe('reading annotations written by other tools', () => {
  it('fills in id, author, color and quads for a bare Highlight', async () => {
    const result = await readAnnotations(await addBareHighlight(await makeBasePdf()));
    expect(result.comments).toHaveLength(1);
    const c = result.comments[0]!;
    expect(c.id).toMatch(/\S/);
    expect(c.author).toBe('不明');
    expect(c.color).toBe(colorForAuthor('不明'));
    expect(c.text).toBe('bare');
    expect(c.anchor).toEqual({ kind: 'highlight', quads: [[72, 718, 300, 732]] });
    expect(c.quote).toBeUndefined();
    expect(c.replies).toEqual([]);
  });

  it('treats a reply whose parent is missing as a standalone note', async () => {
    const result = await readAnnotations(await addOrphanReply(await makeBasePdf()));
    expect(result.comments).toHaveLength(1);
    const c = result.comments[0]!;
    expect(c.anchor).toEqual({ kind: 'note', point: [72, 620] });
    expect(c.author).toBe('someone');
    expect(c.text).toBe('orphan');
  });
});

describe('interoperability with PDF.js', () => {
  it('exposes quadPoints, author, contents and reply linkage through getAnnotations()', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
    const out = await writeAnnotations(await makeBasePdf(), [highlight, note]);
    const loadingTask = pdfjs.getDocument({ data: out });
    const doc = await loadingTask.promise;
    const page = await doc.getPage(1);
    const annots = (await page.getAnnotations()) as Array<Record<string, unknown>>;
    const hl = annots.find((a) => a.subtype === 'Highlight')!;
    expect(hl).toBeDefined();
    expect(Array.from(hl.quadPoints as ArrayLike<number>)).toHaveLength(16);
    expect((hl.titleObj as { str: string }).str).toBe('脇田');
    expect((hl.contentsObj as { str: string }).str).toBe(highlight.text);
    const reply = annots.find((a) => a.subtype === 'Text' && a.inReplyTo)!;
    expect(reply).toBeDefined();
    expect(reply.inReplyTo).toBe(hl.id);
    expect((reply.contentsObj as { str: string }).str).toBe('追記します。');
    await loadingTask.destroy();
  });
});
