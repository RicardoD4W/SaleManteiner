import { describe, expect, it } from 'vitest';
import {
  TAG_MIN_CONTRAST_RATIO,
  TAG_PALETTE,
  TAG_TINT_ALPHA_DARK,
  TAG_TINT_ALPHA_LIGHT,
  contrastRatio,
  getTagTintSpec,
  isAccessibleTagColor,
  isValidTagColor,
  tagRowContrastRatio,
} from '../tagColors';

const MODES = ['light', 'dark'] as const;

describe('tagColors', () => {
  it('every palette color is a valid #rrggbb', () => {
    for (const color of TAG_PALETTE) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(isValidTagColor(color)).toBe(true);
    }
  });

  it('the palette has ten distinct colors', () => {
    expect(TAG_PALETTE).toHaveLength(10);
    expect(new Set(TAG_PALETTE).size).toBe(10);
  });

  it('isValidTagColor accepts #rrggbb and rejects any other format', () => {
    expect(isValidTagColor('#AABBCC')).toBe(true);
    expect(isValidTagColor('#abc')).toBe(false);
    expect(isValidTagColor('red')).toBe(false);
    expect(isValidTagColor('rgb(0,0,0)')).toBe(false);
    expect(isValidTagColor('')).toBe(false);
  });

  it('tints 14% in light mode and 20% in dark mode', () => {
    expect(TAG_TINT_ALPHA_LIGHT).toBe(0.14);
    expect(TAG_TINT_ALPHA_DARK).toBe(0.2);
    expect(getTagTintSpec('light').alpha).toBe(0.14);
    expect(getTagTintSpec('dark').alpha).toBe(0.2);
  });

  it('the tinted row keeps a contrast of 4.5:1 or more for every palette color', () => {
    for (const color of TAG_PALETTE) {
      for (const mode of MODES) {
        const ratio = tagRowContrastRatio(color, mode);
        expect(ratio, `${color} in ${mode} mode`).toBeGreaterThanOrEqual(TAG_MIN_CONTRAST_RATIO);
      }
    }
  });

  it('the tinted row keeps a contrast of 4.5:1 or more for the worst case colors', () => {
    for (const color of ['#ffffff', '#000000']) {
      for (const mode of MODES) {
        const ratio = tagRowContrastRatio(color, mode);
        expect(ratio, `${color} in ${mode} mode`).toBeGreaterThanOrEqual(TAG_MIN_CONTRAST_RATIO);
      }
    }
  });

  it('isAccessibleTagColor accepts the palette and the worst cases', () => {
    for (const color of [...TAG_PALETTE, '#ffffff', '#000000']) {
      expect(isAccessibleTagColor(color), color).toBe(true);
    }
  });

  it('isAccessibleTagColor rejects invalid colors', () => {
    expect(isAccessibleTagColor('red')).toBe(false);
    expect(isAccessibleTagColor('#abc')).toBe(false);
  });

  it('contrastRatio is symmetric and 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });
});
