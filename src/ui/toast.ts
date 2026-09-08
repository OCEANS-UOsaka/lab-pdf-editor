// 画面右下に短時間出る通知。成功・失敗の両方に使う。
let host: HTMLDivElement | null = null;

function ensureHost(): HTMLDivElement {
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.append(host);
  }
  return host;
}

export function toast(message: string, kind: 'info' | 'error' = 'info', durationMs = kind === 'error' ? 6000 : 3500): void {
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  ensureHost().append(el);
  window.setTimeout(() => {
    el.classList.add('is-leaving');
    window.setTimeout(() => el.remove(), 300);
  }, durationMs);
}
