# Keel

**Code quality analyzer for AI-generated TypeScript and JavaScript.**

Claude Code writes fast. Keel makes sure it writes well.

Every file touched during a Claude session gets scored 0–100, violations are surfaced with one-click fix prompts, and a local dashboard lets you inspect exactly what changed and why — all without leaving your machine.

---

## Installation

```bash
npm install -g @ansh0108/keelcode
```

Requires **Node 18+** and [Claude Code](https://claude.ai/code).

---

## Quick start

```bash
# 1. Run inside any project you work on with Claude Code
cd my-project
keel init

# 2. Baseline scan of all existing TS/JS files
keel scan

# 3. Open the dashboard
keel ui
```

After `keel init`, recording is **fully automatic** — just use Claude Code normally. Every file Claude writes or edits gets analyzed in the background.

---

## How it works

```
Claude Code  →  hook event  →  keel record  →  analyzer  →  SQLite  →  keel ui
```

1. `keel init` injects hooks into your project's `.claude/settings.json`
2. Every `Write`, `Edit`, or `Bash` call Claude makes fires the hook automatically
3. Each changed file is scored against 9 quality rules
4. `keel ui` opens a local dashboard at `localhost:2701`

No CI, no cloud, no accounts. Everything stays on your machine.

---

## Commands

| Command | What it does |
|---|---|
| `keel init` | Injects Claude Code hooks, creates `.keel/` dir |
| `keel scan` | One-shot baseline scan of all TS/JS files |
| `keel ui` | Starts the dashboard at `localhost:2701` |
| `keel record` | Called automatically by hooks — records events and analyzes files |
| `keel validate` | Called automatically at session end — validates saved constraints |

---

## Quality rules

Nine rules analyzed on every file:

| Rule | What it catches |
|---|---|
| `file_too_large` | Files over 300 lines |
| `long_function` | Functions over 50 lines |
| `too_many_imports` | More than 12 imports |
| `deep_nesting` | Nesting depth over 4 levels |
| `missing_error_handling` | `await` without `try/catch` |
| `console_log` | `console.log` / `console.error` left in source |
| `todo_comment` | TODO / FIXME / HACK comments |
| `mixed_responsibilities` | Files mixing UI, data fetching, and business logic |
| `god_component` | React components doing too many things |

Each file gets an **overall score from 0–100**. Errors lower the score more than warnings.

---

## Dashboard

`keel ui` opens a local web UI grouped into **Errors**, **Warnings**, and **Clean** sections.

Click any file to open its detail panel:

- Full violation list with descriptions and suggestions
- **Ask Claude to fix** — copies a ready-made prompt to your clipboard
- **Fix Everything** — one prompt that covers all violations across all files
- **Auto-fix** — removes `console.log` calls directly (no Claude needed)
- **Rescan** — re-analyzes after you've applied fixes, shows before → after score

---

## Data

Session data is stored in `.keel/keel.db` — a SQLite file local to each project. Add it to `.gitignore` if you don't want to commit session history.

---

## Contributing

```bash
git clone https://github.com/ansh0108/keel
cd keel
pnpm install
pnpm build
```

---

## License

MIT
