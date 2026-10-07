# Tower Defense: shared team contract

This project is built by a Claude Code **agent team**: one lead session plus teammates. Every teammate loads this file automatically but does **not** see the lead's conversation, so everything shared lives here.

## Goal

A playable browser tower defense MVP: one map, one path, 2 enemy types, 2 tower types, waves, money, lives, and win/lose. The task list lives in `docs/BACKLOG.md`.

## Stack and commands

TypeScript + Vite + HTML5 Canvas, Vitest, ESLint + Prettier, npm.

| Command          | Purpose                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run dev`    | Run the game locally                                                                                              |
| `npm run check`  | typecheck + lint + test. **Must pass before any task is marked completed** (enforced by the `TaskCompleted` hook) |
| `npm test`       | Unit tests only                                                                                                   |
| `npm run format` | Prettier                                                                                                          |

## Ownership: never edit outside your area

Two teammates editing the same file overwrite each other. If you need a change in someone else's area, **message that owner by name** and describe the change.

| Path                                          | Owner role                                                                                                              | Teammate name (default) |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `src/core/` (incl. `types.ts`), `src/main.ts` | architect                                                                                                               | `core`                  |
| `src/entities/`, `src/systems/`               | gameplay-dev                                                                                                            | `gameplay`              |
| `src/render/`, `src/ui/`, `index.html`        | render-ui-dev                                                                                                           | `render`                |
| `src/data/`                                   | content-designer                                                                                                        | `content`               |
| `tests/`                                      | each owner writes tests for their own module under the mirrored path; qa-reviewer adds cross-module and edge-case tests | `qa`                    |
| `docs/BACKLOG.md`                             | lead                                                                                                                    | (lead)                  |
| `docs/DECISIONS.md`                           | architect                                                                                                               | `core`                  |

## Rules

- **Shared types** live only in `src/core/types.ts`. Changes go through `core` and are logged in `docs/DECISIONS.md`.
- **Game logic is deterministic and DOM-free** (`core`, `entities`, `systems`, `data`): no `window`, `document`, timers, or `Math.random` without a seeded RNG. ESLint enforces part of this.
- **State flows one way:** systems produce a new `GameState` each step. `render/` and `ui/` read state and never mutate it. UI sends player intents (for example "place tower") through the core API.
- Every new module comes with a test in `tests/` mirroring its `src/` path.
- **Mark your task completed as soon as it's done.** Task status can lag and block teammates who depend on it.
- Prefer messaging over guessing. Report blockers to the lead immediately instead of stopping silently.
- Keep tasks small: a function, a module plus its test. If a task grows, ask the lead to split it.

## Team notes (agent-teams limitations)

- Teammates can't spawn teammates, and only the lead manages the team.
- `/resume` doesn't restore teammates. `docs/BACKLOG.md` is the durable record, so the lead keeps it current.
- Teammate plan approvals are auto-granted, so `qa` is the real review gate.
