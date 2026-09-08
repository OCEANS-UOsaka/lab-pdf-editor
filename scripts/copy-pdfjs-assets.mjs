// PDF.js が実行時に取りに行く補助ファイル（CMap・標準フォント・wasm・ICC）を public/pdfjs/ に置く。
// これらは同一オリジンから配信する（外部 CDN を使わない＝オフラインでも動き、通信先も増やさない）。
// npm run dev / build の前に自動で走る（package.json の predev / prebuild）。
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../node_modules/pdfjs-dist');
const dest = resolve(here, '../public/pdfjs');

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  await cp(resolve(src, dir), resolve(dest, dir), { recursive: true });
}
console.log(`copied pdfjs assets to ${dest}`);
