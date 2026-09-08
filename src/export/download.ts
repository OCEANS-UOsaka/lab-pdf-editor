// ブラウザからファイルを保存させる。

export function downloadBytes(bytes: Uint8Array, fileName: string, mime = 'application/pdf'): void {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadText(text: string, fileName: string, mime = 'text/markdown;charset=utf-8'): void {
  downloadBytes(new TextEncoder().encode(text), fileName, mime);
}
