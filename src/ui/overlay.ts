import type { GameContent, GameState } from '../core/types';
import { icon } from './icons';

export interface OverlayView {
  title: string;
  subtitle: string;
  kind: 'won' | 'lost';
}

/** Win/lose overlay model, or null while the game is running. Pure. */
export function overlayView(
  state: Readonly<GameState>,
  content: Pick<GameContent, 'waves'>,
): OverlayView | null {
  if (state.status === 'won') {
    const lives = Math.max(0, state.lives);
    return {
      kind: 'won',
      title: 'Victory!',
      subtitle: `All ${content.waves.length} waves cleared with ${lives} ${lives === 1 ? 'life' : 'lives'} left.`,
    };
  }
  if (state.status === 'lost') {
    return {
      kind: 'lost',
      title: 'Defeat',
      subtitle: `Overrun on wave ${Math.max(1, state.wave.index + 1)} of ${content.waves.length}.`,
    };
  }
  return null;
}

export interface Overlay {
  update(state: Readonly<GameState>): void;
}

/** Overlay element inside `stage` (which must be position: relative). */
export function createOverlay(
  stage: HTMLElement,
  content: Pick<GameContent, 'waves'>,
  onRestart: () => void,
): Overlay {
  const root = document.createElement('div');
  root.className = 'overlay';
  root.hidden = true;
  const panel = document.createElement('div');
  panel.className = 'overlay-panel';
  const emblems = { won: icon('trophy', 'overlay-emblem'), lost: icon('skull', 'overlay-emblem') };
  const title = document.createElement('h1');
  const subtitle = document.createElement('p');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Restart';
  button.addEventListener('click', () => onRestart());
  panel.append(emblems.won, title, subtitle, button);
  root.append(panel);
  stage.append(root);

  let prevKey = '';
  return {
    update(state) {
      const v = overlayView(state, content);
      const key = v ? `${v.kind}|${v.subtitle}` : '';
      if (key === prevKey) return;
      prevKey = key;
      root.hidden = v === null;
      if (!v) return;
      root.dataset.kind = v.kind;
      panel.replaceChild(emblems[v.kind], panel.firstElementChild!);
      title.textContent = v.title;
      subtitle.textContent = v.subtitle;
      button.focus();
    },
  };
}
