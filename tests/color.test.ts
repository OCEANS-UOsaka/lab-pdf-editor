import { describe, expect, it } from 'vitest';
import { colorForAuthor, hexToRgb, rgbToHex } from '../src/model/color';

describe('colorForAuthor', () => {
  it('is deterministic and returns #rrggbb', () => {
    const a = colorForAuthor('脇田');
    expect(a).toMatch(/^#[0-9a-f]{6}$/);
    expect(colorForAuthor('脇田')).toBe(a);
  });
  it('gives different authors different colors when the palette allows', () => {
    const names = ['脇田', '平田', '藤田', '郭'];
    const colors = new Set(names.map(colorForAuthor));
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('hex <-> rgb (0..1)', () => {
  it('round-trips', () => {
    expect(rgbToHex(hexToRgb('#ffd54f'))).toBe('#ffd54f');
  });
  it('converts pure red', () => {
    expect(hexToRgb('#ff0000')).toEqual([1, 0, 0]);
  });
  it('rounds and clamps components', () => {
    expect(rgbToHex([1, 0.5, 0])).toBe('#ff8000');
    expect(rgbToHex([2, -1, 0.25])).toBe('#ff0040');
  });
});
