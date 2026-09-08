// 保存するファイルの名前。元の名前を壊さず、版が分かる接尾辞を付ける。

const PDF_EXT = /\.pdf$/i;
const REVIEWED_SUFFIX = '_reviewed';

function baseName(fileName: string): string {
  return fileName.replace(PDF_EXT, '');
}

/** コメント付き PDF の名前。`draft.pdf` → `draft_reviewed.pdf`。既に付いていれば重ねない。 */
export function reviewedFileName(fileName: string): string {
  const base = baseName(fileName);
  return base.endsWith(REVIEWED_SUFFIX) ? `${base}.pdf` : `${base}${REVIEWED_SUFFIX}.pdf`;
}

/** Markdown 一覧の名前。`draft.pdf` → `draft_comments.md` */
export function markdownFileName(fileName: string): string {
  return `${baseName(fileName)}_comments.md`;
}
