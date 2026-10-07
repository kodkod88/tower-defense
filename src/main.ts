// Browser entry point: wires content, the fixed-timestep runner, and the UI together.
// All game logic lives in core/systems; this file only touches the DOM and the clock.
import { createRunner } from './core/runner';
import { content } from './data';
import { mountUI } from './ui';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Canvas #game not found');

const runner = createRunner(content);
const ui = mountUI(canvas, {
  content,
  getState: runner.getState,
  dispatch: runner.dispatch,
  events: runner.bus,
});

let last = performance.now();
function frame(now: number): void {
  runner.update(now - last);
  last = now;
  ui.frame(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
