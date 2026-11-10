export const TAG_PALETTE = [
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0d9488',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#db2777',
  '#92400e',
] as const;

export const TAG_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const TAG_ROW_TINT_CLASS = 'tag-row-tinted';

export const TAG_TINT_ALPHA_LIGHT = 0.14;
export const TAG_TINT_ALPHA_DARK = 0.2;
export const TAG_TINT_ALPHA_HOVER_BONUS = 0.04;

export const TAG_MIN_CONTRAST_RATIO = 4.5;

export type TagColorMode = 'light' | 'dark';

export const TAG_COLOR_MODES: readonly TagColorMode[] = ['light', 'dark'];

export interface TagTintSpec {
  alpha: number;
  background: string;
  text: string;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const TAG_TINT_SPECS: Record<TagColorMode, TagTintSpec> = {
  light: { alpha: TAG_TINT_ALPHA_LIGHT, background: '#ffffff', text: '#1f2937' },
  dark: { alpha: TAG_TINT_ALPHA_DARK, background: '#111827', text: '#e5e7eb' },
};

export function isValidTagColor(value: string): boolean {
  return TAG_COLOR_PATTERN.test(value);
}

export function getTagTintSpec(mode: TagColorMode): TagTintSpec {
  return TAG_TINT_SPECS[mode];
}

export function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) throw new Error(`Invalid hex color: ${hex}`);
  const value = parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (value: number) => value.toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function linearize(channelValue: number): number {
  const value = channelValue / 255;
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function compositeOver(color: string, background: string, alpha: number): string {
  const foreground = hexToRgb(color);
  const base = hexToRgb(background);
  const mix = (top: number, bottom: number) =>
    Math.min(255, Math.max(0, Math.round(top * alpha + bottom * (1 - alpha))));
  return rgbToHex({
    r: mix(foreground.r, base.r),
    g: mix(foreground.g, base.g),
    b: mix(foreground.b, base.b),
  });
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function tagRowContrastRatio(tagColor: string, mode: TagColorMode): number {
  const spec = getTagTintSpec(mode);
  const tintedBackground = compositeOver(tagColor, spec.background, spec.alpha);
  return contrastRatio(spec.text, tintedBackground);
}

export function isAccessibleTagColor(value: string): boolean {
  if (!isValidTagColor(value)) return false;
  return TAG_COLOR_MODES.every(
    (mode) => tagRowContrastRatio(value, mode) >= TAG_MIN_CONTRAST_RATIO,
  );
}
