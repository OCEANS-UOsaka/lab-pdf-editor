// コメント一覧を Markdown にする（Slack・メールに貼る用）。
import { sortComments } from '../model/merge';
import type { Comment } from '../model/types';

export interface MarkdownOptions {
  /** 「出力:」行に載せる日時の文字列。呼び出し側で整形して渡す。省略時はこの行を出さない */
  generatedAt?: string;
}

const QUOTE_MAX = 80;

function formatQuote(quote: string): string {
  const flat = quote.replace(/\s+/g, ' ').trim();
  return flat.length > QUOTE_MAX ? `${flat.slice(0, QUOTE_MAX)}…` : flat;
}

function headline(c: Comment): string {
  if (c.anchor.kind === 'note') return `- **${c.author}**（付箋）`;
  if (c.quote && c.quote.trim()) return `- **${c.author}** 「${formatQuote(c.quote)}」`;
  return `- **${c.author}**（ハイライト）`;
}

export function toMarkdown(doc: { fileName: string; comments: readonly Comment[] }, opts: MarkdownOptions = {}): string {
  const sorted = sortComments(doc.comments);
  const authors: string[] = [];
  for (const c of sorted) if (!authors.includes(c.author)) authors.push(c.author);

  const lines: string[] = [`# ${doc.fileName} — コメント一覧`, ''];
  if (opts.generatedAt) lines.push(`- 出力: ${opts.generatedAt}`);
  lines.push(`- 件数: ${sorted.length}${authors.length ? `（著者: ${authors.join(', ')}）` : ''}`);

  let currentPage = -1;
  for (const c of sorted) {
    if (c.pageIndex !== currentPage) {
      currentPage = c.pageIndex;
      lines.push('', `## p.${currentPage + 1}`, '');
    }
    lines.push(headline(c));
    for (const line of c.text.split(/\r?\n/)) lines.push(`  ${line}`);
    for (const reply of c.replies) lines.push(`  - ↳ **${reply.author}**: ${reply.text.split(/\r?\n/).join(' ')}`);
  }
  lines.push('');
  return lines.join('\n');
}
