// Procedural sprites (U3): towers, enemies and projectiles drawn with plain Canvas 2D shapes.
// Archetype selection and animation math are pure functions so they can be unit-tested.
import type { Enemy, EnemyDef, MapDef, Tower, TowerDef } from '../core/types';
import { cooldownTicksFor } from '../entities/tower';
import { PALETTE, shade, withAlpha } from './theme';

export type TowerArchetype = 'rapid' | 'heavy';
export type EnemyArchetype = 'runner' | 'tank';

/** Visual design for a tower type: by id when known, else by stats (fast firing = rapid). */
export function towerArchetype(id: string, def?: Pick<TowerDef, 'fireRate'>): TowerArchetype {
  if (id === 'rapid' || id === 'heavy') return id;
  return def && def.fireRate < 1.5 ? 'heavy' : 'rapid';
}

/** Visual design for an enemy type: by id when known, else by size (big = tank). */
export function enemyArchetype(id: string, def?: Pick<EnemyDef, 'radius'>): EnemyArchetype {
  if (id === 'runner' || id === 'tank') return id;
  return def && def.radius >= 13 ? 'tank' : 'runner';
}

/** Angle (radians) the enemy is walking: toward its current waypoint. 0 (east) as a fallback. */
export function enemyHeading(
  enemy: Pick<Enemy, 'pos' | 'waypointIndex'>,
  map: Pick<MapDef, 'path'>,
): number {
  const wp = map.path[Math.min(enemy.waypointIndex, map.path.length - 1)];
  if (!wp) return 0;
  const dx = wp.x - enemy.pos.x;
  const dy = wp.y - enemy.pos.y;
  if (dx === 0 && dy === 0) {
    const prev = map.path[enemy.waypointIndex - 1];
    return prev ? Math.atan2(wp.y - prev.y, wp.x - prev.x) : 0;
  }
  return Math.atan2(dy, dx);
}

/**
 * Barrel recoil in [0, 1]: 1 right after a shot, easing to 0 over the first quarter of the
 * cooldown. Derived from state only (no effect bookkeeping needed).
 */
export function recoilAmount(
  tower: Pick<Tower, 'cooldownTicks'>,
  def: TowerDef | undefined,
): number {
  if (!def) return 0;
  const full = cooldownTicksFor(def);
  if (full <= 0 || tower.cooldownTicks <= 0) return 0;
  const f = Math.min(1, tower.cooldownTicks / full);
  return Math.max(0, (f - 0.75) / 0.25);
}

// --- towers ---------------------------------------------------------------------------

/** Stone platform under every tower; `size` is the cell size. */
export function drawTowerBase(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  const h = size * 0.4;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, x - h + 2, y - h + 3, h * 2, h * 2, size * 0.12);
  ctx.fill();
  ctx.fillStyle = PALETTE.stoneDark;
  roundRect(ctx, x - h, y - h, h * 2, h * 2, size * 0.12);
  ctx.fill();
  ctx.fillStyle = PALETTE.stone;
  roundRect(ctx, x - h + 2, y - h + 2, h * 2 - 4, h * 2 - 5, size * 0.09);
  ctx.fill();
  ctx.fillStyle = withAlpha(PALETTE.stoneLight, 0.7);
  ctx.fillRect(x - h + 4, y - h + 2, h * 2 - 8, 2);
  // Corner bolts.
  ctx.fillStyle = PALETTE.stoneDark;
  const b = h - 5;
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + sx * b, y + sy * b, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Rotating turret. `angle` is where the barrel points; `recoil` in [0, 1]. */
export function drawTurret(
  ctx: CanvasRenderingContext2D,
  kind: TowerArchetype,
  x: number,
  y: number,
  size: number,
  angle: number,
  color: string,
  recoil = 0,
): void {
  const u = size / 40; // designed at 40px
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (kind === 'rapid') {
    // Twin light barrels.
    const kick = recoil * 3 * u;
    for (const side of [-1, 1]) {
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(2 * u - kick, side * 4 * u - 2.2 * u, 19 * u, 4.4 * u);
      ctx.fillStyle = '#8f98a3';
      ctx.fillRect(3 * u - kick, side * 4 * u - 1.1 * u, 17 * u, 2.2 * u);
      ctx.fillStyle = shade(color, 0.5);
      ctx.fillRect(18 * u - kick, side * 4 * u - 1.6 * u, 3.2 * u, 3.2 * u);
    }
    // Round head.
    disc(ctx, 0, 0, 10 * u, PALETTE.ink);
    const g = ctx.createRadialGradient(-3 * u, -3 * u, 1, 0, 0, 9 * u);
    g.addColorStop(0, shade(color, 0.45));
    g.addColorStop(1, shade(color, -0.2));
    disc(ctx, 0, 0, 9 * u, g);
    disc(ctx, 0, 0, 3.5 * u, shade(color, -0.45));
    disc(ctx, -1 * u, -1 * u, 1.5 * u, withAlpha('#ffffff', 0.6));
  } else {
    // One chunky cannon.
    const kick = recoil * 5 * u;
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(4 * u - kick, -5 * u, 19 * u, 10 * u);
    ctx.fillStyle = '#5b5f66';
    ctx.fillRect(5 * u - kick, -4 * u, 16 * u, 8 * u);
    ctx.fillStyle = '#7d828a';
    ctx.fillRect(5 * u - kick, -4 * u, 16 * u, 2.5 * u);
    // Muzzle ring.
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(20 * u - kick, -6.5 * u, 5 * u, 13 * u);
    ctx.fillStyle = '#6a6f77';
    ctx.fillRect(21 * u - kick, -5.5 * u, 3 * u, 11 * u);
    // Octagonal armoured head.
    polygon(ctx, 0, 0, 12 * u, 8, Math.PI / 8, PALETTE.ink);
    const g = ctx.createRadialGradient(-4 * u, -4 * u, 1, 0, 0, 12 * u);
    g.addColorStop(0, shade(color, 0.35));
    g.addColorStop(1, shade(color, -0.35));
    polygon(ctx, 0, 0, 10.5 * u, 8, Math.PI / 8, g);
    // Rivets.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      disc(ctx, Math.cos(a) * 7.8 * u, Math.sin(a) * 7.8 * u, 1 * u, shade(color, -0.55));
    }
    disc(ctx, 0, 0, 4.5 * u, shade(color, -0.4));
    disc(ctx, -1.5 * u, -1.5 * u, 1.8 * u, withAlpha('#ffffff', 0.45));
  }
  ctx.restore();
}

// --- enemies --------------------------------------------------------------------------

/**
 * Enemy body facing `heading`. `phase` drives the walk cycle (pass a tick-based value).
 * `flash` in [0, 1] tints the sprite white (hit feedback).
 */
export function drawEnemySprite(
  ctx: CanvasRenderingContext2D,
  kind: EnemyArchetype,
  x: number,
  y: number,
  r: number,
  heading: number,
  color: string,
  phase: number,
  flash = 0,
): void {
  // Ground shadow (not rotated).
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 1, y + r * 0.55, r * 1.05, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  const f = Math.min(1, Math.max(0, flash));
  // Hit flash: brighten the body where canvas filters exist, plus a white rim everywhere.
  if (f > 0) ctx.filter = `brightness(${1 + f * 1.2}) saturate(${1 - f * 0.6})`;
  if (kind === 'runner') drawRunner(ctx, r, color, phase);
  else drawTank(ctx, r, color, phase);
  if (f > 0) {
    ctx.filter = 'none';
    ctx.strokeStyle = withAlpha('#ffffff', 0.85 * f);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * (kind === 'tank' ? 1.2 : 1.1), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRunner(ctx: CanvasRenderingContext2D, r: number, color: string, phase: number): void {
  // Scurrying feet.
  const step = Math.sin(phase) * r * 0.35;
  ctx.fillStyle = shade(color, -0.55);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * step * 0.9, side * r * 0.62, r * 0.32, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Speed streaks behind.
  ctx.strokeStyle = withAlpha(shade(color, 0.5), 0.55);
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const off of [-0.45, 0, 0.45]) {
    ctx.moveTo(-r * 1.2, off * r);
    ctx.lineTo(-r * (1.75 + Math.abs(off)), off * r);
  }
  ctx.stroke();
  // Teardrop body pointing forward.
  ctx.beginPath();
  ctx.moveTo(r * 1.15, 0);
  ctx.quadraticCurveTo(r * 0.3, -r * 1.0, -r * 0.85, -r * 0.6);
  ctx.quadraticCurveTo(-r * 1.15, 0, -r * 0.85, r * 0.6);
  ctx.quadraticCurveTo(r * 0.3, r * 1.0, r * 1.15, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = shade(color, -0.6);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Back stripe and highlight.
  ctx.fillStyle = shade(color, -0.25);
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, 0, r * 0.45, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = withAlpha('#ffffff', 0.35);
  ctx.beginPath();
  ctx.ellipse(r * 0.1, -r * 0.38, r * 0.4, r * 0.14, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Eyes.
  for (const side of [-1, 1]) {
    disc(ctx, r * 0.5, side * r * 0.3, r * 0.2, '#ffffff');
    disc(ctx, r * 0.58, side * r * 0.3, r * 0.1, PALETTE.ink);
  }
}

function drawTank(ctx: CanvasRenderingContext2D, r: number, color: string, phase: number): void {
  const L = r * 1.15; // half length
  const W = r * 0.95; // half width
  // Treads with moving links.
  for (const side of [-1, 1]) {
    const ty = side * W - (side > 0 ? r * 0.38 : 0);
    ctx.fillStyle = PALETTE.ink;
    roundRect(ctx, -L, ty, L * 2, r * 0.38, r * 0.15);
    ctx.fill();
    ctx.fillStyle = '#4a4744';
    const gap = r * 0.36;
    const off = (((phase * r * 0.12) % gap) + gap) % gap;
    for (let lx = -L + off; lx < L - 1; lx += gap) {
      ctx.fillRect(lx, ty + 1, r * 0.14, r * 0.38 - 2);
    }
  }
  // Hull.
  const hullW = W - r * 0.3;
  ctx.fillStyle = shade(color, -0.55);
  roundRect(ctx, -L * 0.92, -hullW - 1, L * 1.84, hullW * 2 + 2, r * 0.3);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -hullW, 0, hullW);
  g.addColorStop(0, shade(color, 0.25));
  g.addColorStop(1, shade(color, -0.25));
  ctx.fillStyle = g;
  roundRect(ctx, -L * 0.88, -hullW, L * 1.76, hullW * 2, r * 0.26);
  ctx.fill();
  // Armour plates.
  ctx.strokeStyle = shade(color, -0.45);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-L * 0.35, -hullW);
  ctx.lineTo(-L * 0.35, hullW);
  ctx.moveTo(L * 0.45, -hullW);
  ctx.lineTo(L * 0.45, hullW);
  ctx.stroke();
  for (const [px, py] of [
    [-L * 0.65, -hullW * 0.6],
    [-L * 0.65, hullW * 0.6],
    [L * 0.7, -hullW * 0.6],
    [L * 0.7, hullW * 0.6],
  ] as const) {
    disc(ctx, px, py, r * 0.08, shade(color, -0.55));
  }
  // Dome with a visor facing forward.
  disc(ctx, 0, 0, r * 0.48, shade(color, -0.5));
  disc(ctx, 0, 0, r * 0.4, shade(color, 0.1));
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(r * 0.12, -r * 0.2, r * 0.2, r * 0.4);
  disc(ctx, -r * 0.12, -r * 0.14, r * 0.12, withAlpha('#ffffff', 0.4));
}

// --- projectiles ----------------------------------------------------------------------

/** Projectile styled after the tower that fired it, travelling along `angle`. */
export function drawProjectileSprite(
  ctx: CanvasRenderingContext2D,
  kind: TowerArchetype | null,
  x: number,
  y: number,
  angle: number,
  color: string,
): void {
  if (kind === 'rapid') {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    ctx.lineCap = 'round';
    ctx.strokeStyle = withAlpha(shade(color, 0.3), 0.55);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - dx * 12, y - dy * 12);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x - dx * 8, y - dy * 8);
    ctx.lineTo(x + dx * 1.5, y + dy * 1.5);
    ctx.stroke();
  } else if (kind === 'heavy') {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    // Smoke trail.
    for (let i = 3; i >= 1; i--) {
      disc(ctx, x - dx * i * 4, y - dy * i * 4, 2 + i * 0.6, withAlpha('#d8d0c0', 0.12 * (4 - i)));
    }
    disc(ctx, x, y, 5.5, withAlpha(shade(color, 0.2), 0.35));
    disc(ctx, x, y, 4.2, PALETTE.ink);
    disc(ctx, x - 1.2, y - 1.2, 1.4, withAlpha('#ffffff', 0.55));
  } else {
    disc(ctx, x, y, 3, '#fff3b0');
  }
}

// --- health bar -----------------------------------------------------------------------

export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  width: number,
  frac: number,
  color: string,
): void {
  const h = 5;
  const x = Math.round(cx - width / 2);
  const y = Math.round(top);
  ctx.fillStyle = 'rgba(15,8,4,0.85)';
  roundRect(ctx, x - 1, y - 1, width + 2, h + 2, 3);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, Math.max(2, width * frac), h, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 1, y + 1, Math.max(0, width * frac - 2), 1.5);
  }
}

// --- primitives -----------------------------------------------------------------------

type Fill = string | CanvasGradient;

export function disc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: Fill,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  ctx.fill();
}

function polygon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  sides: number,
  rot: number,
  fill: Fill,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

/** Rounded rectangle path (works where ctx.roundRect is unavailable). */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
