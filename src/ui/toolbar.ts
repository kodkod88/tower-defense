// Tower cards (U4). One <button> per tower type in hotkey order. Each card's `.card-head`
// textContent is exactly "<hotkey>. <name> $<cost>" (the playtest harness reads it); stats are
// real child elements after it.
import type { GameContent, GameState, TowerDef, TowerTypeId } from '../core/types';
import { towerColor } from '../render/draw';
import { drawTowerBase, drawTurret, towerArchetype } from '../render/sprites';
import { towerButtons } from './placement';

export interface CardStat {
  label: string;
  value: string;
}

export interface TowerCard {
  id: TowerTypeId;
  hotkey: string;
  name: string;
  cost: string;
  stats: CardStat[];
  /** Tooltip / accessible description. */
  description: string;
  selected: boolean;
  affordable: boolean;
}

/** Up to one decimal, trailing ".0" dropped: 4 -> "4", 0.8 -> "0.8", 1.25 -> "1.3". */
export function formatStat(n: number): string {
  if (!Number.isFinite(n)) return '–';
  return String(Math.round(n * 10) / 10);
}

export function cardStats(def: TowerDef): CardStat[] {
  return [
    { label: 'Dmg', value: formatStat(def.damage) },
    { label: 'Rate', value: `${formatStat(def.fireRate)}/s` },
    { label: 'Range', value: formatStat(def.range) },
    { label: 'DPS', value: formatStat(def.damage * def.fireRate) },
  ];
}

/** Toolbar model, same order and hotkeys as towerButtons. Pure. */
export function towerCards(
  state: Readonly<GameState>,
  content: GameContent,
  selected: TowerTypeId | null,
): TowerCard[] {
  return towerButtons(state, content, selected).map((b) => {
    const def = content.towers[b.id]!;
    const stats = cardStats(def);
    return {
      id: b.id,
      hotkey: b.hotkey,
      name: def.name,
      cost: `$${def.cost}`,
      stats,
      description: `${def.name} tower, ${`$${def.cost}`}. ${stats.map((s) => `${s.label} ${s.value}`).join(', ')}. Hotkey ${b.hotkey}.`,
      selected: b.selected,
      affordable: b.affordable,
    };
  });
}

/** The text pieces of a card, in DOM order. Joined, they equal the legacy button label. */
export function cardTextParts(card: Pick<TowerCard, 'hotkey' | 'name' | 'cost'>): string[] {
  return [`${card.hotkey}.`, ` ${card.name}`, ` ${card.cost}`];
}

export interface Toolbar {
  update(state: Readonly<GameState>, selected: TowerTypeId | null): void;
}

export function createToolbar(
  root: HTMLElement,
  content: GameContent,
  initial: Readonly<GameState>,
  onSelect: (id: TowerTypeId) => void,
): Toolbar {
  root.classList.add('toolbar');
  const buttons = new Map<TowerTypeId, HTMLButtonElement>();
  for (const card of towerCards(initial, content, null)) {
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.tower = card.id;
    // Visible text is the accessible name; the title is just a hover tooltip.
    el.title = card.description;

    const iconCanvas = document.createElement('canvas');
    iconCanvas.className = 'card-icon';
    drawCardIcon(iconCanvas, content, card.id);

    const [keyText, nameText, costText] = cardTextParts(card);
    const head = document.createElement('span');
    head.className = 'card-head';
    head.append(
      textSpan('card-key', keyText!),
      textSpan('card-name', nameText!),
      textSpan('card-cost', costText!),
    );
    const stats = document.createElement('span');
    stats.className = 'card-stats';
    for (const s of card.stats) {
      const st = document.createElement('span');
      st.className = 'card-stat';
      st.append(textSpan('card-stat-label', s.label), textSpan('card-stat-value', s.value));
      stats.append(st);
    }
    el.append(iconCanvas, head, stats);
    el.addEventListener('click', () => onSelect(card.id));
    buttons.set(card.id, el);
  }

  const hint = document.createElement('div');
  hint.className = 'toolbar-hint';
  hint.innerHTML =
    `<kbd>1</kbd>–<kbd>${buttons.size}</kbd> pick tower · click to build<br>` +
    '<kbd>Esc</kbd>/right-click cancel · <kbd>Space</kbd> next wave';
  root.replaceChildren(...buttons.values(), hint);

  return {
    update(state, selected) {
      for (const b of towerButtons(state, content, selected)) {
        const el = buttons.get(b.id);
        if (!el) continue;
        el.classList.toggle('selected', b.selected);
        el.classList.toggle('unaffordable', !b.affordable);
        el.setAttribute('aria-pressed', String(b.selected));
      }
    },
  };
}

function textSpan(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

/** Draw the tower's sprite into the card's mini canvas, crisp on high-DPI screens. */
function drawCardIcon(canvas: HTMLCanvasElement, content: GameContent, id: TowerTypeId): void {
  const css = 48;
  const dpr = Math.max(1, Math.min(3, globalThis.devicePixelRatio || 1));
  canvas.width = css * dpr;
  canvas.height = css * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const def = content.towers[id];
  drawTowerBase(ctx, css / 2, css / 2 + 1, 42);
  drawTurret(
    ctx,
    towerArchetype(id, def),
    css / 2,
    css / 2 + 1,
    42,
    -Math.PI / 4,
    towerColor({ type: id }, content),
  );
}
