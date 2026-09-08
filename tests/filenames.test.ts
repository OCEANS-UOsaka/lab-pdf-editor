import { describe, expect, it } from 'vitest';
import { markdownFileName, reviewedFileName } from '../src/export/filenames';

describe('reviewedFileName', () => {
  it('appends _reviewed before the extension', () => {
    expect(reviewedFileName('draft.pdf')).toBe('draft_reviewed.pdf');
  });
  it('does not stack the suffix', () => {
    expect(reviewedFileName('draft_reviewed.pdf')).toBe('draft_reviewed.pdf');
  });
  it('handles names without an extension and uppercase extensions', () => {
    expect(reviewedFileName('draft')).toBe('draft_reviewed.pdf');
    expect(reviewedFileName('DRAFT.PDF')).toBe('DRAFT_reviewed.pdf');
  });
});

describe('markdownFileName', () => {
  it('replaces the extension with _comments.md', () => {
    expect(markdownFileName('draft.pdf')).toBe('draft_comments.md');
    expect(markdownFileName('draft_reviewed.pdf')).toBe('draft_reviewed_comments.md');
  });
});
