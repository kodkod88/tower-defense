import type { GameContent, GameState } from '../core/types';
import { icon } from './icons';

/** Plain view-model for the HUD. Pure, so it can be unit-tested without a DOM. */
export interface HudView {
  money: string;
  lives: string;
  wave: string;
  startLabel: string;
  startDisabled: boolean;
}

export function hudView(state: Readonly<GameState>, content: Pick<GameContent, 'waves'>): HudView {
  const total = content.waves.length;
  // wave.index is -1 before the first wave; show it 1-based to the player.
  const current = Math.max(0, state.wave.index + 1);
  const over = state.status === 'won' || state.status === 'lost';
  const noMoreWaves = state.wave.index + 1 >= total;
  return {
    money: `$${Math.max(0, Math.floor(state.money))}`,
    lives: `♥ ${Math.max(0, state.lives)}`,
    wave: `Wave ${current}/${total}`,
    startLabel: state.wave.index < 0 ? 'Start wave' : 'Next wave',
    startDisabled: over || state.wave.active || noMoreWaves,
  };
}

export interface WaveProgress {
  /** Share of the wave's enemies already resolved (killed or leaked), in [0, 1]. */
  fraction: number;
  /** e.g. "7/20 enemies". */
  label: string;
}

/**
 * Progress through the active wave, or null when no wave is running. Cheap: sums the wave's
 * group counts and spawned counters; enemies alive on the map are the unresolved ones.
 */
export function waveProgress(
  state: Readonly<GameState>,
  content: Pick<GameContent, 'waves'>,
): WaveProgress | null {
  if (!state.wave.active) return null;
  const def = content.waves[state.wave.index];
  if (!def) return null;
  const total = def.groups.reduce((n, g) => n + Math.max(0, g.count), 0);
  if (total <= 0) return null;
  const spawned = state.wave.spawned.reduce((n, s) => n + s, 0);
  const done = Math.min(total, Math.max(0, spawned - state.enemies.length));
  return { fraction: done / total, label: `${done}/${total} enemies` };
}

export interface Hud {
  /** Refresh the DOM from state. Only touches the DOM when a value actually changes. */
  update(state: Readonly<GameState>): void;
  /** Play the lives-lost shake/flash on the lives counter. */
  flashLives(): void;
}

/** Build the HUD inside `root`. `onStartWave` should dispatch the startWave intent. */
export function createHud(
  root: HTMLElement,
  content: Pick<GameContent, 'waves'> & Partial<Pick<GameContent, 'map'>>,
  onStartWave: () => void,
): Hud {
  root.classList.add('hud');

  const title = document.createElement('div');
  title.className = 'hud-title';
  title.textContent = 'Tower Defense';
  if (content.map?.name) {
    const sub = document.createElement('small');
    sub.textContent = content.map.name;
    title.append(sub);
  }

  // The .hud-money / .hud-lives / .hud-wave spans hold plain text only (playtest hooks);
  // icons and the progress bar are siblings inside each .hud-stat pill.
  const money = span('hud-money');
  const lives = span('hud-lives');
  const wave = span('hud-wave');
  const moneyStat = stat('money', icon('coin'), money);
  // The ♥ glyph in the text is the lives icon (it must stay in the text), so no extra SVG.
  const livesStat = stat('lives', lives);
  const progress = document.createElement('div');
  progress.className = 'hud-progress';
  progress.hidden = true;
  const progressFill = document.createElement('div');
  progressFill.className = 'hud-progress-fill';
  progress.append(progressFill);
  const waveStat = stat('wave', icon('swords'), wave, progress);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hud-start';
  button.addEventListener('click', () => onStartWave());
  root.replaceChildren(title, moneyStat, livesStat, waveStat, button);

  let prev: HudView | null = null;
  let prevProgress = '';
  return {
    update(state) {
      const v = hudView(state, content);
      if (prev?.money !== v.money) money.textContent = v.money;
      if (prev?.lives !== v.lives) lives.textContent = v.lives;
      if (prev?.wave !== v.wave) wave.textContent = v.wave;
      if (prev?.startLabel !== v.startLabel) button.textContent = v.startLabel;
      if (prev?.startDisabled !== v.startDisabled) button.disabled = v.startDisabled;
      prev = v;

      const p = waveProgress(state, content);
      const key = p ? p.label : '';
      if (key !== prevProgress) {
        prevProgress = key;
        progress.hidden = p === null;
        if (p) {
          progressFill.style.width = `${(p.fraction * 100).toFixed(1)}%`;
          progress.title = p.label;
        }
      }
    },
    flashLives() {
      restartAnimation(livesStat, 'is-hit');
    },
  };
}

/** Re-trigger a CSS animation class even if it is already applied. */
export function restartAnimation(el: HTMLElement, className: string): void {
  el.classList.remove(className);
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add(className);
}

function stat(kind: string, ...children: Element[]): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `hud-stat hud-stat--${kind}`;
  el.append(...children);
  return el;
}

function span(className: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  return el;
}
