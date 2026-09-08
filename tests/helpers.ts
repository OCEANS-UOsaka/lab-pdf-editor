import type { Comment, Reply } from '../src/model/types';

let seq = 0;
export function mkReply(overrides: Partial<Reply> = {}): Reply {
  seq += 1;
  return {
    id: `r${seq}`,
    author: '平田',
    text: '返信',
    createdAt: '2026-09-08T05:00:00.000Z',
    modifiedAt: '2026-09-08T05:00:00.000Z',
    ...overrides,
  };
}

export function mkComment(overrides: Partial<Comment> = {}): Comment {
  seq += 1;
  return {
    id: `c${seq}`,
    pageIndex: 0,
    anchor: { kind: 'highlight', quads: [[100, 700, 300, 712]] },
    quote: 'the proposed method',
    text: 'ここは根拠が弱い。',
    author: '脇田',
    color: '#ffd54f',
    createdAt: '2026-09-08T05:00:00.000Z',
    modifiedAt: '2026-09-08T05:00:00.000Z',
    replies: [],
    ...overrides,
  };
}
