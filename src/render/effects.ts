// Visual feedback effects (U5): short-lived, UI-only particles. Never part of GameState.
// The lifecycle helpers (spawn, age, expire, cap) are pure; times are milliseconds from any
// monotonic clock (the UI uses performance.now()).
import type { EntityId, Vec2 } from '../core/types';
import { hash2 } from './mapArt';
import { canvasFont, PALETTE, withAlpha } from './theme';

interface Base {
  /** Time the effect was spawned. */
  born: number;
  /** Lifetime in ms. */
  ttl: number;
}

export type Effect =
  | (Base & { kind: 'hitFlash'; enemyId: EntityId })
  | (Base & { kind: 'spark'; pos: Vec2; color: string; seed: number })
  | (Base & { kind: 'puff'; pos: Vec2; radius: number; color: string; seed: number })
  | (Base & { kind: 'floatText'; pos: Vec2; text: string; color: string })
  | (Base & { kind: 'muzzle'; pos: Vec2; angle: number; size: number });

export type EffectKind = Effect['kind'];

/** Default lifetimes (ms). */
export const EFFECT_TTL: Record<EffectKind, number> = {
  hitFlash: 120,
  spark: 220,
  puff: 480,
  floatText: 900,
  muzzle: 90,
};

/** Hard cap on live effects; the oldest are dropped first. */
export const MAX_EFFECTS = 160;

/** Append `effect`, dropping the oldest entries beyond `cap`. Returns a new array. */
export function addEffect(list: readonly Effect[], effect: Effect, cap = MAX_EFFECTS): Effect[] {
  if (cap <= 0) return [];
  const next = [...list, effect];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Age in [0, 1]: 0 when born, 1 when expired. Clamped for clocks that jump. */
export function effectProgress(e: Pick<Effect, 'born' | 'ttl'>, now: number): number {
  if (e.ttl <= 0) return 1;
  return Math.min(1, Math.max(0, (now - e.born) / e.ttl));
}

/** Drop expired effects. Returns the same array when nothing expired (cheap per frame). */
export function pruneEffects(list: readonly Effect[], now: number): readonly Effect[] {
  for (const e of list) {
    if (now - e.born >= e.ttl) return list.filter((x) => now - x.born < x.ttl);
  }
  return list;
}

/** Current hit-flash intensity per enemy, in (0, 1]. */
export function hitFlashes(list: readonly Effect[], now: number): Map<EntityId, number> {
  const out = new Map<EntityId, number>();
  for (const e of list) {
    if (e.kind !== 'hitFlash') continue;
    const v = 1 - effectProgress(e, now);
    if (v > 0) out.set(e.enemyId, Math.max(v, out.get(e.enemyId) ?? 0));
  }
  return out;
}

// --- drawing ---------------------------------------------------------------------------

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** Draw every effect except hit flashes (those tint the enemy sprite itself). */
export function drawEffects(
  ctx: CanvasRenderingContext2D,
  list: readonly Effect[],
  now: number,
): void {
  for (const e of list) {
    const t = effectProgress(e, now);
    if (t >= 1) continue;
    switch (e.kind) {
      case 'spark':
        drawSpark(ctx, e, t);
        break;
      case 'puff':
        drawPuff(ctx, e, t);
        break;
      case 'muzzle':
        drawMuzzle(ctx, e, t);
        break;
      case 'floatText':
        drawFloatText(ctx, e, t);
        break;
      default:
        break;
    }
  }
  ctx.globalAlpha = 1;
}

function drawSpark(
  ctx: CanvasRenderingContext2D,
  e: Extract<Effect, { kind: 'spark' }>,
  t: number,
) {
  const k = easeOut(t);
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = e.color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + hash2(e.seed, i, 90) * 1.2;
    const r0 = 2 + k * 4;
    const r1 = 4 + k * 9;
    ctx.moveTo(e.pos.x + Math.cos(a) * r0, e.pos.y + Math.sin(a) * r0);
    ctx.lineTo(e.pos.x + Math.cos(a) * r1, e.pos.y + Math.sin(a) * r1);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPuff(ctx: CanvasRenderingContext2D, e: Extract<Effect, { kind: 'puff' }>, t: number) {
  const k = easeOut(t);
  // Shock ring.
  ctx.globalAlpha = (1 - t) * 0.9;
  ctx.strokeStyle = '#fff8e0';
  ctx.lineWidth = 3 * (1 - t) + 0.75;
  ctx.beginPath();
  ctx.arc(e.pos.x, e.pos.y, e.radius * (0.6 + k * 1.4), 0, Math.PI * 2);
  ctx.stroke();
  // Smoke blobs drifting outward and up.
  for (let i = 0; i < 7; i++) {
    const a = hash2(e.seed, i, 91) * Math.PI * 2;
    const d = e.radius * (0.3 + hash2(e.seed, i, 92) * 0.9) * k * 1.6;
    const r = e.radius * (0.35 + hash2(e.seed, i, 93) * 0.3) * (1 - t * 0.5);
    ctx.globalAlpha = (1 - t) * 0.85;
    // Mix the enemy colour with dark and light smoke so it reads on both grass and dirt.
    ctx.fillStyle = i % 3 === 0 ? e.color : i % 3 === 1 ? '#5a4f45' : '#e9e1cf';
    ctx.beginPath();
    ctx.arc(e.pos.x + Math.cos(a) * d, e.pos.y + Math.sin(a) * d - k * 6, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMuzzle(
  ctx: CanvasRenderingContext2D,
  e: Extract<Effect, { kind: 'muzzle' }>,
  t: number,
) {
  const s = e.size * (1 - t * 0.4);
  ctx.save();
  ctx.translate(e.pos.x, e.pos.y);
  ctx.rotate(e.angle);
  ctx.globalAlpha = 1 - t;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, withAlpha(PALETTE.gold, 0.9));
  g.addColorStop(1, withAlpha(PALETTE.danger, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  // Flame cone pointing forward plus a small round core.
  ctx.moveTo(-s * 0.2, -s * 0.55);
  ctx.lineTo(s * 1.4, 0);
  ctx.lineTo(-s * 0.2, s * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawFloatText(
  ctx: CanvasRenderingContext2D,
  e: Extract<Effect, { kind: 'floatText' }>,
  t: number,
) {
  const y = e.pos.y - 10 - easeOut(t) * 26;
  ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
  ctx.font = canvasFont('md', 700);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = PALETTE.ink;
  ctx.strokeText(e.text, e.pos.x, y);
  ctx.fillStyle = e.color;
  ctx.fillText(e.text, e.pos.x, y);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
