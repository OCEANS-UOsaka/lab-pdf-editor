// 開発用: PDF の注釈を一覧する。使い方: node scripts/inspect-annotations.mjs <file.pdf>
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFString } from '@cantoo/pdf-lib';
import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/inspect-annotations.mjs <file.pdf>');
  process.exit(2);
}
const doc = await PDFDocument.load(await readFile(file), { ignoreEncryption: true });
const text = (v) => (v instanceof PDFHexString || v instanceof PDFString ? v.decodeText() : v === undefined ? undefined : String(v));
doc.getPages().forEach((page, i) => {
  const annots = page.node.Annots();
  console.log(`--- page ${i + 1}: ${annots ? annots.size() : 0} annots`);
  if (!annots) return;
  for (let k = 0; k < annots.size(); k++) {
    const raw = annots.get(k);
    const dict = raw instanceof PDFRef ? doc.context.lookup(raw) : raw;
    if (!(dict instanceof PDFDict)) continue;
    const get = (key) => dict.lookup(PDFName.of(key));
    const quads = get('QuadPoints');
    console.log(
      JSON.stringify({
        ref: raw instanceof PDFRef ? raw.toString() : '(direct)',
        Subtype: String(get('Subtype')),
        T: text(get('T')),
        Contents: text(get('Contents')),
        NM: text(get('NM')),
        M: text(get('M')),
        C: get('C') instanceof PDFArray ? get('C').asArray().map(String) : undefined,
        Rect: get('Rect') instanceof PDFArray ? get('Rect').asArray().map(String) : undefined,
        QuadPoints: quads instanceof PDFArray ? quads.size() : undefined,
        IRT: get('IRT') ? String(dict.get(PDFName.of('IRT'))) : undefined,
        Popup: dict.get(PDFName.of('Popup')) ? String(dict.get(PDFName.of('Popup'))) : undefined,
        LPEQuote: text(get('LPEQuote')),
      }),
    );
  }
});
