/** PDF ユーザ空間の矩形 [llx, lly, urx, ury]（原点は左下・単位 pt） */
export type Rect = [llx: number, lly: number, urx: number, ury: number];

/** コメントが指す場所 */
export type Anchor =
  | { kind: 'highlight'; quads: Rect[] }
  | { kind: 'note'; point: [x: number, y: number] };

export interface Reply {
  id: string;
  author: string;
  text: string;
  createdAt: string; // ISO 8601
  modifiedAt: string; // ISO 8601
}

export interface Comment {
  id: string;
  pageIndex: number; // 0 始まり
  anchor: Anchor;
  /** ハイライトした文字列（highlight のみ） */
  quote?: string;
  text: string;
  author: string;
  /** '#rrggbb' */
  color: string;
  createdAt: string;
  modifiedAt: string;
  replies: Reply[];
}

export interface ReviewDoc {
  fileName: string;
  pageCount: number;
  comments: Comment[];
  /** 本アプリが触らない注釈の件数（Subtype → 件数）。表示はしないが保存時に保持する */
  foreignAnnotations: Record<string, number>;
}

/** 著者名が無い注釈に与える名前 */
export const UNKNOWN_AUTHOR = '不明';
