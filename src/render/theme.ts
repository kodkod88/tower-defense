// Shared visual theme ("warm fantasy"): one palette and type scale for both the canvas and the DOM.
// index.html declares the same values as CSS custom properties on :root; tests/render/theme.test.ts
// fails if the two drift apart, so change both together.

export const PALETTE = {
  // Chrome (page, panels, text)
  bg: '#16120d',
  bgDeep: '#0d0a07',
  panel: '#2a2117',
  panelRaised: '#3a2d1f',
  border: '#5c4630',
  borderLight: '#8f6d45',
  text: '#f2e6cc',
  textDim: '#b3a080',
  // Accents
  gold: '#f0c04a',
  goldDeep: '#a87a24',
  danger: '#e0533d',
  success: '#8cc44e',
  info: '#62b4ea',
  // Terrain
  grass: '#4d7a35',
  grassLight: '#679a48',
  grassDark: '#3a6127',
  dirt: '#b38955',
  dirtLight: '#cfa673',
  dirtDark: '#76522f',
  stone: '#8c857a',
  stoneLight: '#b9b2a3',
  stoneDark: '#4f4a43',
  ink: '#1b140e',
} as const;

export type PaletteKey = keyof typeof PALETTE;

export const FONT = {
  family: "'Trebuchet MS', 'Segoe UI', system-ui, -apple-system, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  /** Type scale in CSS pixels. */
  size: { xs: 11, sm: 13, md: 16, lg: 20, xl: 28, display: 52 },
} as const;

export type FontSize = keyof typeof FONT.size;

export const RADIUS = { sm: 4, md: 8, lg: 14 } as const;

/** Canvas font shorthand, e.g. canvasFont('sm', 700) -> "700 13px 'Trebuchet MS', ...". */
export function canvasFont(size: FontSize, weight: 400 | 600 | 700 = 400): string {
  return `${weight} ${FONT.size[size]}px ${FONT.family}`;
}

/** camelCase -> kebab-case ("panelRaised" -> "panel-raised"). */
export function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** The CSS custom properties index.html must declare on :root, with their exact values. */
export function themeCssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(PALETTE)) vars[`--color-${kebab(k)}`] = v;
  vars['--font-family'] = FONT.family;
  vars['--font-mono'] = FONT.mono;
  for (const [k, v] of Object.entries(FONT.size)) vars[`--font-size-${k}`] = `${v}px`;
  for (const [k, v] of Object.entries(RADIUS)) vars[`--radius-${k}`] = `${v}px`;
  return vars;
}

/** '#rrggbb' + alpha -> 'rgba(r,g,b,a)'. Invalid input returns the input unchanged. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = Number.parseInt(m[1]!, 16);
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Lighten (amount > 0) or darken (amount < 0) a '#rrggbb' color by mixing toward white/black. */
export function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = Number.parseInt(m[1]!, 16);
  const t = Math.min(1, Math.max(-1, amount));
  const target = t > 0 ? 255 : 0;
  const mix = (c: number) => Math.round(c + (target - c) * Math.abs(t));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
