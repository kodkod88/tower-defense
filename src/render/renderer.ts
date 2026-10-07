import { TICKS_PER_SECOND } from '../core/types';
import type {
  Enemy,
  EntityId,
  GameContent,
  GameState,
  GridCell,
  MapDef,
  TowerTypeId,
  Vec2,
} from '../core/types';
import { COLORS, enemyColor, enemyRadius, healthColor, healthFraction, towerColor } from './draw';
import { cellCenter, cellOrigin } from './grid';
import { drawEffects, hitFlashes, type Effect } from './effects';
import { createMapLayerCache, drawMapArt } from './mapArt';
import {
  drawEnemySprite,
  drawHealthBar,
  drawProjectileSprite,
  drawTowerBase,
  drawTurret,
  enemyArchetype,
  enemyHeading,
  recoilAmount,
  roundRect,
  towerArchetype,
} from './sprites';
import { canvasFont, PALETTE } from './theme';

/** UI-only state the renderer needs for previews. Never part of GameState. */
export interface RenderView {
  /** Tower type the player has selected to place, if any. */
  selectedTower: TowerTypeId | null;
  /** Grid cell under the mouse, if any. */
  hoverCell: GridCell | null;
  /** Whether placing selectedTower at hoverCell would be accepted. */
  hoverValid: boolean;
  /** Player-facing reason the placement is invalid, drawn next to the preview. */
  hoverReason?: string | null;
  /** UI-side feedback effects (U5) to draw on top of the entities. */
  effects?: readonly Effect[];
  /** Frame timestamp (ms, same clock as the effects) used to age effects. */
  now?: number;
  /** Render memory owned by the caller (one per canvas); see createRenderMemory. */
  memory?: RenderMemory;
}

const EMPTY_VIEW: RenderView = { selectedTower: null, hoverCell: null, hoverValid: false };

/** Barrel angle when a tower has never had a target (pointing up). */
export const IDLE_AIM = -Math.PI / 2;

/** Where a turret points: at its target if any, else where it last pointed, else IDLE_AIM. */
export function resolveAim(
  from: Vec2,
  target: Vec2 | undefined,
  previous: number | undefined,
): number {
  if (target) return Math.atan2(target.y - from.y, target.x - from.x);
  return previous ?? IDLE_AIM;
}

/**
 * Per-canvas render memory (UI-only, never GameState): each turret's last aim so idle turrets
 * don't snap back. Cleared when the simulation tick goes backwards (restart).
 */
export interface RenderMemory {
  aim: Map<EntityId, number>;
  tick: number;
}

export function createRenderMemory(): RenderMemory {
  return { aim: new Map(), tick: -1 };
}

/** Note the frame's tick; forget remembered aims if the game restarted. */
export function syncRenderMemory(mem: RenderMemory, tick: number): void {
  if (tick < mem.tick) mem.aim.clear();
  mem.tick = tick;
}

/**
 * Draws the current state. Reads state only and never mutates it. Owned by render-ui-dev.
 */
export function render(
  ctx: CanvasRenderingContext2D,
  state: Readonly<GameState>,
  content: GameContent,
  view: RenderView = EMPTY_VIEW,
): void {
  // Without a memory (e.g. one-off renders in tests) aims are not remembered between calls.
  const memory = view.memory ?? createRenderMemory();
  syncRenderMemory(memory, state.tick);

  const enemiesById = new Map<EntityId, Enemy>();
  for (const e of state.enemies) enemiesById.set(e.id, e);

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawMap(ctx, content.map);
  drawHoverRange(ctx, state, content, view);
  drawTowers(ctx, state, content, enemiesById, memory.aim);
  const effects = view.effects ?? [];
  const now = view.now ?? 0;
  drawEnemies(ctx, state, content, effects.length > 0 ? hitFlashes(effects, now) : null);
  drawProjectiles(ctx, state, content, enemiesById);
  if (effects.length > 0) drawEffects(ctx, effects, now);
  drawPreview(ctx, state, content, view);
}

// --- R1/U2: map ------------------------------------------------------------------------

const mapLayer = createMapLayerCache();

/** Blit the pre-rendered static map; draws it directly when no offscreen canvas exists. */
export function drawMap(ctx: CanvasRenderingContext2D, map: MapDef): void {
  const layer = mapLayer.get(map);
  if (layer) ctx.drawImage(layer, 0, 0);
  else drawMapArt(ctx, map);
}

// --- R2/U3: entities ------------------------------------------------------------------

/** Range ring for an existing tower under the mouse (when not placing). */
function drawHoverRange(
  ctx: CanvasRenderingContext2D,
  state: Readonly<GameState>,
  content: GameContent,
  view: RenderView,
): void {
  if (view.selectedTower !== null || view.hoverCell === null) return;
  const { col, row } = view.hoverCell;
  const tower = state.towers.find((t) => t.cell.col === col && t.cell.row === row);
  const def = tower && content.towers[tower.type];
  if (tower && def) ring(ctx, tower.pos.x, tower.pos.y, def.range, COLORS.rangeValid);
}

function drawTowers(
  ctx: CanvasRenderingContext2D,
  state: Readonly<GameState>,
  content: GameContent,
  enemiesById: ReadonlyMap<EntityId, Enemy>,
  lastAim: Map<EntityId, number>,
): void {
  const t = content.map.tileSize;
  for (const tower of state.towers) {
    const def = content.towers[tower.type];
    const target = tower.targetId === null ? undefined : enemiesById.get(tower.targetId);
    const angle = resolveAim(tower.pos, target?.pos, lastAim.get(tower.id));
    lastAim.set(tower.id, angle);
    drawTowerBase(ctx, tower.pos.x, tower.pos.y, t);
    drawTurret(
      ctx,
      towerArchetype(tower.type, def),
      tower.pos.x,
      tower.pos.y,
      t,
      angle,
      towerColor(tower, content),
      recoilAmount(tower, def),
    );
  }
}

function drawEnemies(
  ctx: CanvasRenderingContext2D,
  state: Readonly<GameState>,
  content: GameContent,
  flashes: ReadonlyMap<EntityId, number> | null,
): void {
  for (const enemy of state.enemies) {
    const def = content.enemies[enemy.type];
    const r = enemyRadius(enemy, content);
    const phase = (state.tick * enemy.speed) / TICKS_PER_SECOND / 4 + enemy.id;
    drawEnemySprite(
      ctx,
      enemyArchetype(enemy.type, def),
      enemy.pos.x,
      enemy.pos.y,
      r,
      enemyHeading(enemy, content.map),
      enemyColor(enemy, content),
      phase,
      flashes?.get(enemy.id) ?? 0,
    );
    const frac = healthFraction(enemy.hp, enemy.maxHp);
    drawHealthBar(
      ctx,
      enemy.pos.x,
      enemy.pos.y - r - 10,
      Math.max(18, r * 2.2),
      frac,
      healthColor(frac),
    );
  }
}

function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  state: Readonly<GameState>,
  content: GameContent,
  enemiesById: ReadonlyMap<EntityId, Enemy>,
): void {
  const towersById = new Map(state.towers.map((t) => [t.id, t] as const));
  for (const p of state.projectiles) {
    const tower = towersById.get(p.towerId);
    const target = enemiesById.get(p.targetId);
    const from = tower?.pos ?? p.pos;
    const angle = target
      ? Math.atan2(target.pos.y - p.pos.y, target.pos.x - p.pos.x)
      : Math.atan2(p.pos.y - from.y, p.pos.x - from.x);
    const kind = tower ? towerArchetype(tower.type, content.towers[tower.type]) : null;
    const color = tower ? towerColor(tower, content) : COLORS.projectile;
    drawProjectileSprite(ctx, kind, p.pos.x, p.pos.y, angle, color);
  }
}

// --- R4: placement preview ------------------------------------------------------------

function drawPreview(
  ctx: CanvasRenderingContext2D,
  state: Readonly<GameState>,
  content: GameContent,
  view: RenderView,
): void {
  if (!view.selectedTower || !view.hoverCell) return;
  if (state.status === 'won' || state.status === 'lost') return;
  const def = content.towers[view.selectedTower];
  if (!def) return;
  const t = content.map.tileSize;
  const c = cellCenter(view.hoverCell, t);
  const o = cellOrigin(view.hoverCell, t);
  ring(ctx, c.x, c.y, def.range, view.hoverValid ? COLORS.rangeValid : COLORS.rangeInvalid);
  ctx.fillStyle = view.hoverValid ? COLORS.previewValid : COLORS.previewInvalid;
  roundRect(ctx, o.x + 1, o.y + 1, t - 2, t - 2, 5);
  ctx.fill();
  ctx.globalAlpha = 0.65;
  drawTowerBase(ctx, c.x, c.y, t);
  drawTurret(
    ctx,
    towerArchetype(def.id, def),
    c.x,
    c.y,
    t,
    IDLE_AIM,
    towerColor({ type: def.id }, content),
  );
  ctx.globalAlpha = 1;
  if (!view.hoverValid && view.hoverReason) {
    drawLabel(ctx, view.hoverReason, c.x, o.y - 6, ctx.canvas.width);
  }
}

/** Small text tag centred above (x, bottomY), kept inside the canvas horizontally. */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  bottomY: number,
  canvasWidth: number,
): void {
  ctx.font = canvasFont('sm', 700);
  const w = ctx.measureText(text).width + 14;
  const h = 22;
  const left = Math.min(Math.max(2, x - w / 2), Math.max(2, canvasWidth - w - 2));
  const top = Math.max(2, bottomY - h);
  ctx.fillStyle = 'rgba(27,20,14,0.9)';
  roundRect(ctx, left, top, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = PALETTE.danger;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, left + 7, top + h / 2 + 1);
}

// --- primitives -----------------------------------------------------------------------

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = COLORS.rangeStroke;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
}
