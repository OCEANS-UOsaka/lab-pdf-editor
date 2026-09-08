// PDF.js の初期化と文書の読み込み。描画専用（注釈の読み書きは pdf/annotations.ts）。
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// CMap・標準フォント・wasm・ICC は同一オリジン（public/pdfjs/）から配信する。scripts/copy-pdfjs-assets.mjs が置く。
const ASSET_BASE = `${import.meta.env.BASE_URL}pdfjs/`;

export interface LoadedPdf {
  doc: pdfjs.PDFDocumentProxy;
  destroy(): Promise<void>;
}

export class PdfOpenError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'PdfOpenError';
  }
}

export async function loadPdfDocument(bytes: Uint8Array): Promise<LoadedPdf> {
  // getDocument はバッファを Worker へ移送して空にするので、必ずコピーを渡す（元バイト列は pdf-lib の保存に使う）。
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    cMapUrl: `${ASSET_BASE}cmaps/`,
    standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
    wasmUrl: `${ASSET_BASE}wasm/`,
    iccUrl: `${ASSET_BASE}iccs/`,
  });
  try {
    const doc = await task.promise;
    return { doc, destroy: () => task.destroy() };
  } catch (err) {
    if (err instanceof pdfjs.PasswordException) {
      throw new PdfOpenError('パスワード付き PDF は開けません。保護を解除した PDF を使ってください。', err);
    }
    if (err instanceof pdfjs.InvalidPDFException) {
      throw new PdfOpenError('PDF として読み取れませんでした。ファイルが壊れているか、PDF ではない可能性があります。', err);
    }
    throw new PdfOpenError(`PDF を開けませんでした: ${err instanceof Error ? err.message : String(err)}`, err);
  }
}
