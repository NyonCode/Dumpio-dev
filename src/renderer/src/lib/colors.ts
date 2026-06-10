/**
 * Static Tailwind class maps for server/flag colors.
 *
 * IMPORTANT: never build color classes dynamically (e.g. `bg-${color}-500`) —
 * Tailwind's JIT purges classes it can't see as literal strings, so dynamic
 * ones vanish in production builds. Always look colors up in these maps.
 */

export const SERVER_COLOR_NAMES = [
  'blue',
  'red',
  'green',
  'yellow',
  'purple',
  'pink',
  'gray'
] as const

export type ServerColor = (typeof SERVER_COLOR_NAMES)[number]

/** Solid dot/swatch background per server color. */
export const SERVER_DOT: Record<string, string> = {
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  gray: 'bg-gray-500'
}

export function serverDot(color: string): string {
  return SERVER_DOT[color] ?? SERVER_DOT.gray
}

/**
 * Accent color presets for Appearance settings. The `value` matches the
 * `data-accent` attribute / `--accent-*` CSS variable sets in index.css;
 * `swatch` is a literal Tailwind class (kept in the safelist below) used to
 * render the picker dot — it must NOT use the recolored `blue` palette.
 */
export const ACCENT_OPTIONS = [
  { value: 'blue', label: 'Blue', swatch: 'bg-sky-500' },
  { value: 'violet', label: 'Violet', swatch: 'bg-violet-500' },
  { value: 'emerald', label: 'Emerald', swatch: 'bg-emerald-500' },
  { value: 'rose', label: 'Rose', swatch: 'bg-rose-500' },
  { value: 'amber', label: 'Amber', swatch: 'bg-amber-500' },
  { value: 'cyan', label: 'Cyan', swatch: 'bg-cyan-500' }
] as const

export type AccentColor = (typeof ACCENT_OPTIONS)[number]['value']
