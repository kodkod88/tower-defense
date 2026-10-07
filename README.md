# Tower Defense

A browser tower defense game (TypeScript + Vite + Canvas), built by a Claude Code agent team.

## Run

```bash
npm install
npm run dev      # open the printed URL
```

## Develop

```bash
npm run check    # typecheck + lint + tests (required before a task is done)
npm test         # tests only
npm run format   # prettier
npm run build    # production build in dist/
```

## Working with the agent team

- Shared rules and file ownership: [CLAUDE.md](CLAUDE.md)
- Task list: [docs/BACKLOG.md](docs/BACKLOG.md)
- Architecture decisions: [docs/DECISIONS.md](docs/DECISIONS.md)
- Teammate roles: `.claude/agents/`
- Agent teams are enabled in `.claude/settings.json`. Start an **interactive** `claude` session here (not `-p`) and ask the lead to spawn the team.
