// Static map art (U2): textured grass, a dirt path with edges, spawn and exit gates.
// Everything is drawn once into an offscreen layer and blitted each frame. All "randomness" comes
// from a hash of integer coordinates, so the map looks identical on every load.
import type { MapDef, Vec2 } from '../core/types';
import { PALETTE, shade, withAlpha } from './theme';

// --- deterministic noise (pure) ---------------------------------------------------------

/** Integer hash of (x, y, salt) -> [0, 1). Same inputs always give the same output. */
export function hash2(x: number, y: number, salt = 0): number {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smooth value noise in [0, 1) sampled on a lattice of `scale` units. */
export function valueNoise(x: number, y: number, scale: number, salt = 0): number {
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = smooth(gx - x0);
  const ty = smooth(gy - y0);
  const a = hash2(x0, y0, salt);
  const b = hash2(x0 + 1, y0, salt);
  const c = hash2(x0, y0 + 1, salt);
  const d = hash2(x0 + 1, y0 + 1, salt);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

export type Decoration =
  | { kind: 'blade'; x: number; y: number; len: number; lean: number; light: boolean }
  | { kind: 'flower'; x: number; y: number; color: string }
  | { kind: 'rock'; x: number; y: number; r: number };

export interface GrassCell {
  /** Base fill color for the cell. */
  color: string;
  /** Decorations in cell-local pixels (0..tileSize). */
  decorations: Decoration[];
}

const FLOWER_COLORS = ['#f4efe0', '#f2d15c', '#e78fb3', '#a9c8f0'];

/** Pure, deterministic description of one grass cell. */
export function grassCell(col: number, row: number, tileSize: number): GrassCell {
  // Large soft patches plus a small per-cell jitter and a faint checker so the build grid reads.
  const patch = valueNoise(col, row, 4, 1) - 0.5;
  const jitter = hash2(col, row, 2) - 0.5;
  const checker = (col + row) % 2 === 0 ? 0.012 : -0.012;
  const color = shade(PALETTE.grass, patch * 0.2 + jitter * 0.03 + checker);

  const decorations: Decoration[] = [];
  const blades = 3 + Math.floor(hash2(col, row, 3) * 4);
  for (let i = 0; i < blades; i++) {
    decorations.push({
      kind: 'blade',
      x: 3 + hash2(col, row, 10 + i) * (tileSize - 6),
      y: 6 + hash2(col, row, 20 + i) * (tileSize - 8),
      len: 3 + hash2(col, row, 30 + i) * 4,
      lean: (hash2(col, row, 40 + i) - 0.5) * 3,
      light: hash2(col, row, 50 + i) > 0.5,
    });
  }
  const f = hash2(col, row, 4);
  if (f < 0.09) {
    decorations.push({
      kind: 'flower',
      x: 6 + hash2(col, row, 5) * (tileSize - 12),
      y: 6 + hash2(col, row, 6) * (tileSize - 12),
      color: FLOWER_COLORS[Math.floor(hash2(col, row, 7) * FLOWER_COLORS.length)]!,
    });
  } else if (f > 0.95) {
    decorations.push({
      kind: 'rock',
      x: 8 + hash2(col, row, 8) * (tileSize - 16),
      y: 8 + hash2(col, row, 9) * (tileSize - 16),
      r: 2.5 + hash2(col, row, 11) * 2.5,
    });
  }
  return { color, decorations };
}

/** Points every `step` px along a polyline with the unit direction of their segment. */
export function samplePath(path: readonly Vec2[], step: number): { p: Vec2; dir: Vec2 }[] {
  const out: { p: Vec2; dir: Vec2 }[] = [];
  if (step <= 0) return out;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    for (let d = 0; d < len; d += step)
      out.push({ p: { x: a.x + dir.x * d, y: a.y + dir.y * d }, dir });
  }
  return out;
}

/** Unit direction at the start (into the map) or end (out of the map) of the path. */
export function endDirection(path: readonly Vec2[], end: 'start' | 'end'): Vec2 {
  const [a, b] =
    end === 'start' ? [path[0], path[1]] : [path[path.length - 2], path[path.length - 1]];
  if (!a || !b) return { x: 1, y: 0 };
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return len === 0 ? { x: 1, y: 0 } : { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

// --- drawing ---------------------------------------------------------------------------

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Draw the whole static map into `ctx`. Called once per map (see createMapLayerCache). */
export function drawMapArt(ctx: Ctx2D, map: MapDef): void {
  drawGrass(ctx, map);
  drawPath(ctx, map);
  drawGates(ctx, map);
  drawVignette(ctx, map);
}

function drawGrass(ctx: Ctx2D, map: MapDef): void {
  const t = map.tileSize;
  const bladeDark = shade(PALETTE.grassDark, -0.15);
  const bladeLight = PALETTE.grassLight;
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      const cell = grassCell(col, row, t);
      const ox = col * t;
      const oy = row * t;
      ctx.fillStyle = cell.color;
      ctx.fillRect(ox, oy, t, t);
      for (const d of cell.decorations) {
        if (d.kind === 'blade') {
          ctx.strokeStyle = d.light ? bladeLight : bladeDark;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(ox + d.x, oy + d.y);
          ctx.lineTo(ox + d.x + d.lean, oy + d.y - d.len);
          ctx.stroke();
        } else if (d.kind === 'flower') {
          ctx.fillStyle = d.color;
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2;
            ctx.beginPath();
            ctx.arc(
              ox + d.x + Math.cos(a) * 1.8,
              oy + d.y + Math.sin(a) * 1.8,
              1.6,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
          ctx.fillStyle = PALETTE.gold;
          ctx.beginPath();
          ctx.arc(ox + d.x, oy + d.y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = withAlpha('#000000', 0.25);
          ctx.beginPath();
          ctx.ellipse(ox + d.x + 1, oy + d.y + 1.5, d.r, d.r * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = PALETTE.stone;
          ctx.beginPath();
          ctx.ellipse(ox + d.x, oy + d.y, d.r, d.r * 0.75, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = PALETTE.stoneLight;
          ctx.beginPath();
          ctx.arc(ox + d.x - d.r * 0.3, oy + d.y - d.r * 0.3, d.r * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  // Faint build grid.
  ctx.strokeStyle = 'rgba(20,35,10,0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let col = 1; col < map.cols; col++) {
    ctx.moveTo(col * t + 0.5, 0);
    ctx.lineTo(col * t + 0.5, map.rows * t);
  }
  for (let row = 1; row < map.rows; row++) {
    ctx.moveTo(0, row * t + 0.5);
    ctx.lineTo(map.cols * t, row * t + 0.5);
  }
  ctx.stroke();
}

function strokePolyline(ctx: Ctx2D, path: readonly Vec2[], width: number, color: string, dy = 0) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y + dy) : ctx.lineTo(p.x, p.y + dy)));
  ctx.stroke();
}

function drawPath(ctx: Ctx2D, map: MapDef): void {
  const { path, pathWidth: w } = map;
  if (path.length < 2) return;
  strokePolyline(ctx, path, w + 12, 'rgba(0,0,0,0.22)', 3); // drop shadow
  strokePolyline(ctx, path, w + 6, PALETTE.dirtDark); // edge
  strokePolyline(ctx, path, w, PALETTE.dirt);
  strokePolyline(ctx, path, w * 0.45, withAlpha(PALETTE.dirtLight, 0.45)); // worn centre

  // Pebbles and dirt specks.
  const specks = samplePath(path, 7);
  specks.forEach(({ p, dir }, i) => {
    const h = hash2(i, 0, 60);
    if (h > 0.55) return;
    const off = (hash2(i, 1, 61) - 0.5) * w * 0.8;
    const x = p.x - dir.y * off;
    const y = p.y + dir.x * off;
    const r = 0.8 + hash2(i, 2, 62) * 1.6;
    ctx.fillStyle = h < 0.2 ? PALETTE.dirtDark : h < 0.4 ? PALETTE.dirtLight : PALETTE.stone;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Grass fringe overhanging both edges.
  const fringe = samplePath(path, 5);
  ctx.lineWidth = 1.4;
  fringe.forEach(({ p, dir }, i) => {
    for (const side of [-1, 1]) {
      const h = hash2(i, side, 70);
      if (h > 0.7) continue;
      const off = side * (w / 2 + 3 - hash2(i, side, 71) * 4);
      const x = p.x - dir.y * off;
      const y = p.y + dir.x * off;
      ctx.strokeStyle = h < 0.35 ? PALETTE.grassLight : PALETTE.grass;
      ctx.beginPath();
      ctx.moveTo(x, y + 2);
      ctx.lineTo(x + (hash2(i, side, 72) - 0.5) * 3, y - 3);
      ctx.stroke();
    }
  });
}

function drawGates(ctx: Ctx2D, map: MapDef): void {
  const { path, pathWidth: w } = map;
  if (path.length < 2) return;
  const start = path[0]!;
  const end = path[path.length - 1]!;
  const dIn = endDirection(path, 'start');
  const dOut = endDirection(path, 'end');
  const inset = Math.min(22, w * 0.55);
  drawGate(
    ctx,
    { x: start.x + dIn.x * inset, y: start.y + dIn.y * inset },
    dIn,
    w,
    PALETTE.info, // blue: green blends into the grass
  );
  drawGate(ctx, { x: end.x - dOut.x * inset, y: end.y - dOut.y * inset }, dOut, w, PALETTE.danger);
}

/** Two stone pillars with banners flanking the path, a coloured glow and chevrons along `dir`. */
function drawGate(ctx: Ctx2D, at: Vec2, dir: Vec2, w: number, color: string): void {
  const nx = -dir.y;
  const ny = dir.x;
  // Ground glow.
  const R = w * 1.3;
  const glow = ctx.createRadialGradient(at.x, at.y, 2, at.x, at.y, R);
  glow.addColorStop(0, withAlpha(color, 0.7));
  glow.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(at.x, at.y, R, 0, Math.PI * 2);
  ctx.fill();

  // Chevrons pointing in the walking direction.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const k of [-1, 0, 1]) {
    const cx = at.x + dir.x * k * 9;
    const cy = at.y + dir.y * k * 9;
    const chevron = () => {
      ctx.beginPath();
      ctx.moveTo(cx - dir.x * 5 + nx * 8, cy - dir.y * 5 + ny * 8);
      ctx.lineTo(cx + dir.x * 3, cy + dir.y * 3);
      ctx.lineTo(cx - dir.x * 5 - nx * 8, cy - dir.y * 5 - ny * 8);
      ctx.stroke();
    };
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 5;
    chevron();
    ctx.strokeStyle = shade(color, 0.45);
    ctx.lineWidth = 3;
    chevron();
  }

  // Pillars with pennants.
  const s = 14;
  for (const side of [-1, 1]) {
    const px = at.x + nx * side * (w / 2 + 9);
    const py = at.y + ny * side * (w / 2 + 9);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(px - s / 2 + 2, py - s / 2 + 3, s, s);
    ctx.fillStyle = PALETTE.stoneDark;
    ctx.fillRect(px - s / 2, py - s / 2, s, s);
    ctx.fillStyle = PALETTE.stone;
    ctx.fillRect(px - s / 2 + 1.5, py - s / 2 + 1.5, s - 3, s - 5);
    ctx.fillStyle = PALETTE.stoneLight;
    ctx.fillRect(px - s / 2 + 1.5, py - s / 2 + 1.5, s - 3, 2);
    // Pole + pennant.
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py - 2);
    ctx.lineTo(px, py - 20);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(px + 1, py - 20);
    ctx.lineTo(px + 12, py - 16);
    ctx.lineTo(px + 1, py - 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(color, -0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawVignette(ctx: Ctx2D, map: MapDef): void {
  const W = map.cols * map.tileSize;
  const H = map.rows * map.tileSize;
  const g = ctx.createRadialGradient(
    W / 2,
    H / 2,
    Math.min(W, H) * 0.45,
    W / 2,
    H / 2,
    Math.hypot(W, H) / 2,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,6,2,0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// --- offscreen layer cache --------------------------------------------------------------

export interface LayerCanvas {
  getContext(id: '2d'): Ctx2D | null;
}

/** Creates an offscreen canvas of the given size, or null when none is available (e.g. tests). */
export type LayerFactory = (
  width: number,
  height: number,
) => (CanvasImageSource & LayerCanvas) | null;

export const browserLayerFactory: LayerFactory = (width, height) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  return null;
};

export interface MapLayerCache {
  /** Pre-rendered static map for `map`, rebuilt only when the map object or size changes. */
  get(map: MapDef): CanvasImageSource | null;
}

export function createMapLayerCache(factory: LayerFactory = browserLayerFactory): MapLayerCache {
  let key: { map: MapDef; w: number; h: number } | null = null;
  let layer: CanvasImageSource | null = null;
  return {
    get(map) {
      const w = map.cols * map.tileSize;
      const h = map.rows * map.tileSize;
      if (key && key.map === map && key.w === w && key.h === h) return layer;
      key = { map, w, h };
      layer = null;
      const canvas = w > 0 && h > 0 ? factory(w, h) : null;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        drawMapArt(ctx, map);
        layer = canvas;
      }
      return layer;
    },
  };
}
