export const ACCENT_COLOR_STORAGE_KEY = 'accentColor';

export const ACCENT_COLOR_PRESETS = [
  'system',
  'teal',
  'blue',
  'green',
  'yellow',
  'orange',
  'red',
  'pink',
  'purple',
  'gray',
] as const;

export type AccentColorPreset = (typeof ACCENT_COLOR_PRESETS)[number];

export type AccentColorOption = {
  preset: AccentColorPreset;
  label: string;
  swatch: string;
  foreground: string;
};

export const DEFAULT_ACCENT_COLOR: AccentColorPreset = 'system';

export const ACCENT_COLOR_OPTIONS: AccentColorOption[] = [
  { preset: 'system', label: 'System', swatch: 'AccentColor', foreground: 'AccentColorText' },
  { preset: 'teal', label: 'Teal', swatch: '#00b894', foreground: '#ffffff' },
  { preset: 'blue', label: 'Blue', swatch: '#37adff', foreground: '#0b1020' },
  { preset: 'green', label: 'Green', swatch: '#51cd00', foreground: '#0b1020' },
  { preset: 'yellow', label: 'Yellow', swatch: '#ffcb00', foreground: '#18181b' },
  { preset: 'orange', label: 'Orange', swatch: '#ff9f00', foreground: '#18181b' },
  { preset: 'red', label: 'Red', swatch: '#ff613d', foreground: '#ffffff' },
  { preset: 'pink', label: 'Pink', swatch: '#ff4ad8', foreground: '#ffffff' },
  { preset: 'purple', label: 'Purple', swatch: '#af51f5', foreground: '#ffffff' },
  { preset: 'gray', label: 'Gray', swatch: '#7c7c7d', foreground: '#ffffff' },
];

export function isAccentColorPreset(value: unknown): value is AccentColorPreset {
  return typeof value === 'string' && ACCENT_COLOR_PRESETS.includes(value as AccentColorPreset);
}

export function resolveAccentColorPreset(value: unknown): AccentColorPreset {
  return isAccentColorPreset(value) ? value : DEFAULT_ACCENT_COLOR;
}

export function getAccentColorOption(preset: AccentColorPreset): AccentColorOption {
  return ACCENT_COLOR_OPTIONS.find(option => option.preset === preset) || ACCENT_COLOR_OPTIONS[0];
}

export function applyAccentColorPreset(target: HTMLElement, preset: AccentColorPreset): void {
  const option = getAccentColorOption(preset);
  const supportsNativeAccent =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('color', 'AccentColor') &&
    CSS.supports('color', 'AccentColorText');

  if (option.preset === 'system' && supportsNativeAccent) {
    target.style.setProperty('--accent-color', 'var(--native-accent, AccentColor)');
    target.style.setProperty('--accent-text', 'var(--native-accent-text, AccentColorText)');
    target.style.setProperty('--accent-hover', 'color-mix(in srgb, var(--accent-color) 85%, black)');
    return;
  }

  const fallback = option.preset === 'system' ? getAccentColorOption('purple') : option;
  target.style.setProperty('--accent-color', fallback.swatch);
  target.style.setProperty('--accent-text', fallback.foreground);
  target.style.setProperty('--accent-hover', `color-mix(in srgb, ${fallback.swatch} 85%, black)`);
}
