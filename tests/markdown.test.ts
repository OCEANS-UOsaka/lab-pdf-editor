import { describe, expect, it } from 'vitest';
import { toMarkdown } from '../src/export/markdown';
import { mkComment, mkReply } from './helpers';

const doc = {
  fileName: 'draft.pdf',
  comments: [
    mkComment({ id: 'p3', pageIndex: 2, quote: 'results', text: 'OK' }),
    mkComment({
      id: 'p1a',
      pageIndex: 0,
      text: 'ここは根拠が弱い。\n引用を足す。',
      replies: [mkReply({ author: '平田', text: '追記します。' })],
    }),
    mkComment({
      id: 'p1b',
      pageIndex: 0,
      author: '平田',
      anchor: { kind: 'note', point: [100, 400] },
      quote: undefined,
      text: '図1の軸ラベル',
    }),
  ],
};

describe('toMarkdown', () => {
  const md = toMarkdown(doc, { generatedAt: '2026-09-08 14:00' });

  it('starts with a title and a header listing count and authors', () => {
    expect(md.startsWith('# draft.pdf — コメント一覧\n')).toBe(true);
    expect(md).toContain('- 出力: 2026-09-08 14:00\n');
    expect(md).toContain('- 件数: 3（著者: 脇田, 平田）\n');
  });

  it('groups comments by page in page order', () => {
    const p1 = md.indexOf('## p.1');
    const p3 = md.indexOf('## p.3');
    expect(p1).toBeGreaterThan(0);
    expect(p3).toBeGreaterThan(p1);
    expect(md).not.toContain('## p.2');
  });

  it('renders quote, multi-line body and indented replies for a highlight', () => {
    expect(md).toContain(
      ['- **脇田** 「the proposed method」', '  ここは根拠が弱い。', '  引用を足す。', '  - ↳ **平田**: 追記します。'].join('\n'),
    );
  });

  it('marks notes as 付箋 and omits the quote', () => {
    expect(md).toContain(['- **平田**（付箋）', '  図1の軸ラベル'].join('\n'));
  });

  it('truncates long quotes', () => {
    const long = 'a'.repeat(120);
    const out = toMarkdown({ fileName: 'x.pdf', comments: [mkComment({ quote: long })] });
    expect(out).toContain(`「${'a'.repeat(80)}…」`);
  });

  it('omits the generatedAt line when not given', () => {
    const out = toMarkdown({ fileName: 'x.pdf', comments: [] });
    expect(out).not.toContain('出力:');
    expect(out).toContain('- 件数: 0');
  });
});
