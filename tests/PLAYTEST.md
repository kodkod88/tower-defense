# MVP playtest checklist (Q5)

Run `npm run dev` and open the printed URL. Tick each item. Anything that fails goes to the owner in brackets.
Automated coverage already exists for logic (Q1 determinism, Q2 full win/loss, Q4 edge cases); this list is for what only a human can see.

## 1. Load (render, core)

- [ ] Page loads with no console errors; canvas is 960×640 and centred.
- [ ] Map shows checkerboard grass, a brown snake path entering left (row 2) and exiting right (row 13), green spawn dot, red exit dot.
- [ ] HUD shows `$100`, `♥ 20`, `Wave 0/5`, and an enabled **Start wave** button.
- [ ] Toolbar shows `1. Rapid $50` and `2. Heavy $100`.

## 2. Placement (render, gameplay)

- [ ] Click **Rapid** (or press `1`): button highlights; hovering the grid shows a green cell + range circle on grass.
- [ ] Hover the path: preview turns red with label "Can't build on the path".
- [ ] Hover a cell that only touches the path edge (directly above/below the path): green, placeable.
- [ ] Place a Rapid: money drops to `$50`, tower appears centred in the cell.
- [ ] Hover the same cell: red, "Cell occupied". Clicking does nothing.
- [ ] Select **Heavy** with `$50`: button looks dimmed (unaffordable); preview red "Not enough money"; clicking does nothing, money unchanged.
- [ ] Right-click or `Esc` clears the selection; pressing `1` twice toggles it off.
- [ ] Mouse leaving the canvas removes the preview.
- [ ] Resize the browser narrower than 960px: clicks still land on the cell under the cursor (CSS scaling).
- [ ] Rapid double-click on one cell places only one tower and charges once.

## 3. Waves and combat (gameplay, render)

- [ ] **Start wave** (or `Space`/`Enter`): HUD shows `Wave 1/5`, button disabled while the wave is active.
- [ ] Runners spawn at the left edge ~1/s and walk the whole path smoothly (no jumps at corners).
- [ ] Health bars above enemies shrink green → yellow → red.
- [ ] Towers rotate their barrel toward the target and fire visible projectiles that home in.
- [ ] Killing an enemy adds its bounty to money immediately; enemy disappears with no leftover projectiles orbiting.
- [ ] An enemy reaching the exit disappears and lives drop (runner −1, tank −2).
- [ ] When the wave ends the button re-enables as **Next wave** and the wave reward is added.
- [ ] Wave 2 introduces tanks (larger, red, slower) a few seconds in.
- [ ] Hovering an existing tower with nothing selected shows its range.
- [ ] Building during a wave works.

## 4. Win and lose (gameplay, render)

- [ ] Build nothing and start waves: lose during wave 2. **Defeat** overlay shows "Overrun on wave 2 of 5"; lives show `♥ 0`, never negative.
- [ ] After defeat: Start button disabled, clicks on the canvas place nothing, money doesn't change.
- [ ] **Restart** (button focused; `Enter` works): fresh game `$100 / ♥ 20 / Wave 0/5`, no enemies, towers or projectiles; selection cleared.
- [ ] Build the D5 layout (tests/data/balance.test.ts `GOOD_LAYOUT`), starting each wave as soon as possible: **Victory!** overlay after wave 5, with lives left (expected about 18).
- [ ] After victory, Restart works the same way.

## 5. Robustness (core)

- [ ] Switch tabs for 30s during a wave, then come back: the game resumes without a burst of fast-forward (frames are capped at 250ms) and nothing teleports.
- [ ] Hold `Space` after the last wave: nothing breaks (rejected intents are ignored).
- [ ] Play two games with identical inputs: same outcome (deterministic; no randomness yet).
- [ ] Performance: wave 5 (44 enemies: 26 runners + 18 tanks, plus 13+ towers) stays smooth at 60 fps.

## Known issues at review time

- None open. (C5 `placeTower` after game over was fixed by core; covered in `tests/edge/placement-and-combat.test.ts`.)
