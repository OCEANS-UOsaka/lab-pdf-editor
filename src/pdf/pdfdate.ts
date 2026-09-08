// PDF の日付文字列（PDF 32000-1 §7.9.4 "D:YYYYMMDDHHmmSSOHH'mm'"）と ISO 8601 の相互変換。

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/**
 * ISO 8601 の時刻を PDF 日付文字列にする。
 * @param tzOffsetMinutes 表示に使うタイムゾーンのオフセット（分・UTC+9 なら 540）。省略時はこの環境のローカル時刻。
 */
export function toPdfDate(iso: string, tzOffsetMinutes?: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`不正な日時です: ${iso}`);
  const offset = tzOffsetMinutes ?? -date.getTimezoneOffset();
  const shifted = new Date(date.getTime() + offset * 60_000);
  const core =
    'D:' +
    pad(shifted.getUTCFullYear(), 4) +
    pad(shifted.getUTCMonth() + 1) +
    pad(shifted.getUTCDate()) +
    pad(shifted.getUTCHours()) +
    pad(shifted.getUTCMinutes()) +
    pad(shifted.getUTCSeconds());
  if (offset === 0) return `${core}Z`;
  const sign = offset > 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${core}${sign}${pad(Math.floor(abs / 60))}'${pad(abs % 60)}'`;
}

// 先頭の "D:" は省略可。年以外の各要素も省略可。タイムゾーンは Z / +HH'mm' / +HH'mm / +HH のいずれか。
const PDF_DATE_RE = /^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(Z|[+-]\d{2}(?:'\d{2}'?)?)?$/;

/** PDF 日付文字列を ISO 8601（UTC）にする。解釈できなければ undefined。 */
export function fromPdfDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = PDF_DATE_RE.exec(value.trim());
  if (!m) return undefined;
  const [, year, month = '01', day = '01', hour = '00', minute = '00', second = '00', tz] = m;
  let offsetMinutes = 0;
  if (tz && tz !== 'Z') {
    const sign = tz.startsWith('-') ? -1 : 1;
    const hh = Number(tz.slice(1, 3));
    const mm = Number(tz.slice(4, 6) || '0');
    offsetMinutes = sign * (hh * 60 + mm);
  }
  const utc =
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)) -
    offsetMinutes * 60_000;
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
