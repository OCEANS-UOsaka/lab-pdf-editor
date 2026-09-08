import { describe, expect, it } from 'vitest';
import { fromPdfDate, toPdfDate } from '../src/pdf/pdfdate';

describe('toPdfDate', () => {
  it('renders an ISO instant in the given timezone offset', () => {
    expect(toPdfDate('2026-09-08T05:00:00.000Z', 540)).toBe("D:20260908140000+09'00'");
  });
  it('renders UTC with Z', () => {
    expect(toPdfDate('2026-09-08T05:00:00.000Z', 0)).toBe('D:20260908050000Z');
  });
  it('renders negative offsets', () => {
    expect(toPdfDate('2026-09-08T05:00:00.000Z', -300)).toBe("D:20260908000000-05'00'");
  });
});

describe('fromPdfDate', () => {
  it('parses a full date with offset', () => {
    expect(fromPdfDate("D:20260908140000+09'00'")).toBe('2026-09-08T05:00:00.000Z');
  });
  it('parses Z and a missing D: prefix', () => {
    expect(fromPdfDate('20260908050000Z')).toBe('2026-09-08T05:00:00.000Z');
  });
  it('parses a date-only value as midnight UTC', () => {
    expect(fromPdfDate('D:20260908')).toBe('2026-09-08T00:00:00.000Z');
  });
  it("accepts an offset without the trailing apostrophe", () => {
    expect(fromPdfDate("D:20260908140000+09'00")).toBe('2026-09-08T05:00:00.000Z');
  });
  it('returns undefined for garbage', () => {
    expect(fromPdfDate('yesterday')).toBeUndefined();
    expect(fromPdfDate('')).toBeUndefined();
  });
});
