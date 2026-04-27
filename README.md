# Keel

Code quality analyzer for AI-generated TypeScript and JavaScript.

Claude Code writes fast. Keel makes sure it writes well. Every file touched during a Claude session gets scored 0–100, violations are surfaced with fix prompts, and a visual UI lets you inspect exactly what changed and why.

---

## How it works

1. `keel init` injects hooks into your project's `.claude/settings.json`
2. Every Write, Edit, or Bash call Claude makes gets recorded automatically
3. Each changed file is analyzed against 9 quality rules and scored
4. `keel ui` opens a local dashboard — browse files, see violations, copy fix prompts, rescan after fixing

No CI, no cloud, no accounts. Everything runs locally.

---

## Installation

Requires Node 22+, pnpm, and [Claude Code](https://claude.ai/code).

```bash
git clone https://github.com/ansh0108/keel
cd keel
pnpm install
pnpm build
cd packages/cli && npm link
```

---

## Usage

### In any project you want to monitor

```bash
# Set up hooks and create the .keel/ directory
keel init

# Baseline scan of all existing TS/JS files
keel scan

# Open the dashboard
keel ui
```

After `keel init`, recording is automatic — just use Claude Code normally. Every session is captured and analyzed in the background.

### Commands

| Command | What it does |
|---------|-------------|
| `keel init` | Injects Claude Code hooks, creates `.keel/` dir |
| `keel scan` | One-shot baseline scan of all TS/JS files in the project |
| `keel ui` | Starts the local server and opens the dashboard at `localhost:2701` |
| `keel record` | Called automatically by hooks — records a hook event and analyzes changed files |
| `keel validate` | Called automatically at session end — validates constraints |

---

## Quality rules

Keel analyzes each file against 9 rules:

| Rule | What it catches |
|------|----------------|
| `file_too_large` | Files over 300 lines |
| `long_function` | Functions over 50 lines |
| `too_many_imports` | More than 12 imports |
| `deep_nesting` | Nesting depth over 4 levels |
| `missing_error_handling` | `await` without try/catch |
| `console_log` | `console.log` / `console.error` left in source |
| `todo_comment` | TODO / FIXME / HACK comments |
| `mixed_responsibilities` | Files mixing UI, data fetching, and business logic |
| `god_component` | React components doing too many things |

Each file gets an overall score from 0–100. Violations reduce the score based on severity (errors more than warnings).

---

## Dashboard

The UI groups files into **Errors**, **Warnings**, and **Clean** sections. Click any file to open the detail panel:

- Full violation list with suggestions
- **Ask Claude to fix** — copies a ready-made fix prompt to clipboard
- **Fix Everything** — copies a single prompt covering all violations across all files
- **Rescan** — re-analyzes after you've applied fixes, shows before → after score inline

---

## Project structure

```
packages/
├── core        — shared types and SQLite schema
├── recorder    — parses Claude Code hook events, writes to DB
├── analyzer    — ts-morph AST analysis, scoring, rules
├── server      — Hono HTTP server, REST API
├── cli         — keel init / scan / ui / record / validate commands
└── ui          — React + Vite dashboard
```

Data is stored in `.keel/keel.db` (SQLite, local to each project, gitignored).

---

## Requirements

- Node 24+ (uses `node:sqlite` built-in)
- pnpm
- Claude Code CLI

---

## License

MIT
