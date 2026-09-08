// コメントの並び順と、複数コピーからの取り込み統合（重複除去）。
import type { Anchor, Comment } from './types';

// 1pt 単位に丸める（0.5pt 未満の座標ゆらぎは同じ場所とみなす）
const roundPoint = (v: number): number => Math.round(v);

function geometryKey(anchor: Anchor): string {
  if (anchor.kind === 'note') return `note:${anchor.point.map(roundPoint).join(',')}`;
  return `hl:${anchor.quads.map((q) => q.map(roundPoint).join(',')).join(';')}`;
}

/** id が違っても同じコメントとみなすための指紋。幾何は 1pt 単位で丸める。 */
export function fingerprint(c: Comment): string {
  return [c.pageIndex, geometryKey(c.anchor), c.author.trim(), c.text.trim()].join('|');
}

/** アンカーの上端（PDF ユーザ空間の y。大きいほど上） */
export function anchorTop(anchor: Anchor): number {
  if (anchor.kind === 'note') return anchor.point[1];
  return Math.max(...anchor.quads.map((q) => q[3]));
}

/** アンカーの左端 */
export function anchorLeft(anchor: Anchor): number {
  if (anchor.kind === 'note') return anchor.point[0];
  return Math.min(...anchor.quads.map((q) => q[0]));
}

/** ページ順 → 上から → 左から → 作成順。入力は変更しない。 */
export function sortComments(comments: readonly Comment[]): Comment[] {
  return [...comments].sort(
    (a, b) =>
      a.pageIndex - b.pageIndex ||
      anchorTop(b.anchor) - anchorTop(a.anchor) ||
      anchorLeft(a.anchor) - anchorLeft(b.anchor) ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export interface MergeResult {
  merged: Comment[];
  /** 新たに加わった件数 */
  added: number;
  /** 既にあるとみなして取り込まなかった件数（返信だけは合流させる） */
  skipped: number;
}

/**
 * base に incoming を統合する。同じ id、または同じ指紋のものは既存を優先し、返信だけを id で合流させる。
 */
export function mergeComments(base: readonly Comment[], incoming: readonly Comment[]): MergeResult {
  const merged: Comment[] = base.map((c) => ({ ...c, replies: c.replies.map((r) => ({ ...r })) }));
  const byId = new Map(merged.map((c) => [c.id, c]));
  const byFingerprint = new Map(merged.map((c) => [fingerprint(c), c]));
  let added = 0;
  let skipped = 0;

  for (const inc of incoming) {
    const existing = byId.get(inc.id) ?? byFingerprint.get(fingerprint(inc));
    if (existing) {
      const replyIds = new Set(existing.replies.map((r) => r.id));
      for (const reply of inc.replies) {
        if (replyIds.has(reply.id)) continue;
        existing.replies.push({ ...reply });
        replyIds.add(reply.id);
      }
      skipped += 1;
      continue;
    }
    const copy: Comment = { ...inc, replies: inc.replies.map((r) => ({ ...r })) };
    merged.push(copy);
    byId.set(copy.id, copy);
    byFingerprint.set(fingerprint(copy), copy);
    added += 1;
  }
  return { merged, added, skipped };
}
