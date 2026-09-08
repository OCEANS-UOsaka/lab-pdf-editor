// 著者ごとの色。統合表示で「誰のコメントか」を色で見分けるために使う。

export type Rgb = [r: number, g: number, b: number]; // 各成分 0..1（PDF の /C と同じ）

// 白地の上でハイライトとして使える淡い色。順序は見分けやすさ優先。
const PALETTE = ['#ffd54f', '#a5d6a7', '#90caf9', '#f48fb1', '#ffab91', '#ce93d8', '#80cbc4', '#ef9a9a'];

/** 著者名から決定的に色を選ぶ。 */
export function colorForAuthor(name: string): string {
  let hash = 0;
  for (const ch of name.trim()) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return PALETTE[hash % PALETTE.length] as string;
}

export function hexToRgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`不正な色です: ${hex}`);
  return [parseInt(m[1] as string, 16) / 255, parseInt(m[2] as string, 16) / 255, parseInt(m[3] as string, 16) / 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const component = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${component(r)}${component(g)}${component(b)}`;
}
