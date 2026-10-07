// Wires HUD, toolbar, overlay, canvas input and rendering together. The only entry main.ts needs.
import type { EventBus } from '../core/events';
import type { GameContent, GameState, GridCell, PlayerIntent, TowerTypeId } from '../core/types';
import { clientToCanvas, pixelToCell } from '../render/grid';
import { createRenderMemory, render, type RenderView } from '../render/renderer';
import { createFeedback } from './feedback';
import { createHud, restartAnimation } from './hud';
import { createOverlay } from './overlay';
import { createToolbar } from './toolbar';
import {
  clickIntent,
  previewPlacement,
  previewReasonText,
  towerForHotkey,
  type CanPlaceFn,
} from './placement';

export interface UIDeps {
  content: GameContent;
  /** Current state; read-only to the UI. */
  getState: () => Readonly<GameState>;
  /** Send a player intent to the core intent API (C5 applyIntent). */
  dispatch: (intent: PlayerIntent) => void;
  /**
   * Optional override of the placement check. Defaults to gameplay's canPlaceTower, which is
   * the same check applyIntent runs, so main.ts does not need to pass anything.
   */
  canPlace?: CanPlaceFn;
  /**
   * Optional runner event bus (runner.bus). When given, game events drive feedback effects:
   * hit flash, death puff, floating bounty, muzzle flash and the lives-lost shake.
   */
  events?: EventBus;
}

export interface MountedUI {
  /**
   * Draw the canvas and refresh the DOM from the current state. Call once per animation frame.
   * `now` is the frame timestamp in ms (defaults to performance.now()).
   */
  frame(now?: number): void;
  /** Remove listeners (for tests / hot reload). */
  destroy(): void;
}

/**
 * Expects index.html to contain #hud, #toolbar and #stage (wrapping the canvas). Missing
 * containers are created next to the canvas so the UI still works with a bare page.
 */
export function mountUI(canvas: HTMLCanvasElement, deps: UIDeps): MountedUI {
  const { content, getState, dispatch, canPlace } = deps;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  const world = content.map;
  canvas.width = world.cols * world.tileSize;
  canvas.height = world.rows * world.tileSize;

  const stage = canvas.parentElement ?? document.body;
  const hudRoot = ensure('hud', stage, 'before');
  const toolbarRoot = ensure('toolbar', stage, 'after');

  const memory = createRenderMemory();
  let selected: TowerTypeId | null = null;
  let hoverCell: GridCell | null = null;

  const hud = createHud(hudRoot, content, () => dispatch({ type: 'startWave' }));
  const overlay = createOverlay(stage, content, () => {
    selected = null;
    dispatch({ type: 'restart' });
  });

  // --- feedback effects (U5), only when the runner's event bus is provided ---
  let pendingLivesFlash = false;
  const livesLost = () => {
    hud.flashLives();
    restartAnimation(stage, 'is-hit');
  };
  const feedback = deps.events
    ? createFeedback({
        bus: deps.events,
        content,
        getState,
        onLivesLost: () => (pendingLivesFlash = true),
      })
    : null;
  // Without a bus, fall back to spotting a lives drop between frames.
  let prevLives = getState().lives;
  let prevTick = getState().tick;

  // --- toolbar (tower cards) ---
  const toolbar = createToolbar(toolbarRoot, content, getState(), (id) => toggle(id));

  function toggle(id: TowerTypeId): void {
    selected = selected === id ? null : id;
  }

  // --- canvas input ---
  const cellAt = (e: MouseEvent): GridCell | null => {
    const r = canvas.getBoundingClientRect();
    return pixelToCell(clientToCanvas(e.clientX, e.clientY, r, canvas.width, canvas.height), world);
  };
  const onMove = (e: MouseEvent) => (hoverCell = cellAt(e));
  const onLeave = () => (hoverCell = null);
  const onClick = (e: MouseEvent) => {
    const cell = cellAt(e);
    const valid =
      !!selected && !!cell && previewPlacement(getState(), content, selected, cell, canPlace).ok;
    const intent = clickIntent(selected, cell, valid);
    if (intent) dispatch(intent);
  };
  const onContext = (e: MouseEvent) => {
    e.preventDefault();
    selected = null;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'Escape') selected = null;
    else if (e.key === ' ' || e.key === 'Enter') {
      if (e.target instanceof HTMLButtonElement) return; // let the focused button handle it
      e.preventDefault();
      dispatch({ type: 'startWave' });
    } else {
      const id = towerForHotkey(e.key, content);
      if (id) toggle(id);
    }
  };
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('contextmenu', onContext);
  window.addEventListener('keydown', onKey);

  return {
    frame(now = performance.now()) {
      const state = getState();
      // Coalesce: at most one lives flash (two forced reflows) per frame, however many leaks.
      if (!feedback && state.tick > prevTick && state.lives < prevLives) pendingLivesFlash = true;
      if (pendingLivesFlash) {
        pendingLivesFlash = false;
        livesLost();
      }
      prevLives = state.lives;
      prevTick = state.tick;
      feedback?.observe(state);
      const preview =
        selected && hoverCell
          ? previewPlacement(state, content, selected, hoverCell, canPlace)
          : null;
      const valid = preview?.ok ?? false;
      const view: RenderView = {
        selectedTower: selected,
        hoverCell,
        hoverValid: valid,
        hoverReason: preview ? previewReasonText(preview) : null,
        effects: feedback?.effects(now),
        now,
        memory,
      };
      render(ctx, state, content, view);
      hud.update(state);
      overlay.update(state);
      toolbar.update(state, selected);
      canvas.style.cursor = selected ? (valid ? 'pointer' : 'not-allowed') : 'default';
    },
    destroy() {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('contextmenu', onContext);
      window.removeEventListener('keydown', onKey);
      feedback?.destroy();
    },
  };
}

function ensure(id: string, stage: HTMLElement, where: 'before' | 'after'): HTMLElement {
  const existing = document.getElementById(id);
  if (existing) return existing;
  const el = document.createElement('div');
  el.id = id;
  if (where === 'before') stage.before(el);
  else stage.after(el);
  return el;
}
