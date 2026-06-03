# Keel

Code quality analyzer for AI-generated TypeScript, JavaScript, and Python.

Claude Code writes fast. Keel makes sure it writes well. Every file touched during a Claude session gets scored 0–100, violations are surfaced with fix prompts, and a visual UI lets you inspect exactly what changed and why.

It catches the things AI gets wrong: hallucinated imports, orphaned dead code, god objects, and business logic leaking into UI — alongside classic quality checks. Plug it into Claude Code as an MCP server for live, in-editor review, or run an optional LLM-as-judge pass for deeper semantic feedback.

---

## How it works

1. `keel init` injects hooks into your project's `.claude/settings.json`
2. Every Write, Edit, or Bash call Claude makes gets recorded automatically
3. Each changed file is analyzed against 18 quality rules (TS/JS and Python) and scored
4. `keel ui` opens a local dashboard — browse files, see violations, copy fix prompts, rescan after fixing

No CI, no cloud, no accounts. Everything runs locally.

---

## Installation

Requires Node 18+, and [Claude Code](https://claude.ai/code).

```bash
npm install -g @ansh0108/keelcode
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
| `keel mcp` | Runs Keel as an MCP server (stdio) for live review inside Claude Code |
| `keel judge <file>` | Semantic LLM review of a file (naming, logic, comments, security) |
| `keel blame [filter]` | Shows quality regressions and which edits caused them |
| `keel report [session]` | Prints an agent report card for a session |
| `keel record` | Called automatically by hooks — records a hook event and analyzes changed files |
| `keel validate` | Called automatically at session end — validates constraints |

---

## Quality rules

Keel analyzes each file against 18 rules, routing by file extension: TypeScript/JavaScript files (`.ts/.tsx/.js/.jsx`) go through a ts-morph AST engine, Python files (`.py/.pyi`) through a dependency-free Python analyzer. Violations reduce the file's 0–100 score by the penalty shown (errors hurt more than warnings).

### Shared & TypeScript/JavaScript

| Rule | Penalty | What it catches |
|------|:-------:|----------------|
| `hallucinated_import` | 25 | Imports of packages neither declared in the manifest nor installed — the signature of an AI-hallucinated dependency (works for both npm and pip) |
| `god_object` | 30 | A class or module that concentrates too many responsibilities |
| `circular_dependency` | 25 | Modules that import each other directly or transitively |
| `business_logic_in_ui` | 20 | Data access or business rules embedded directly in UI components |
| `file_too_large` | 15 | Files over the line-count threshold (default 300) |
| `god_component` | 12 | React components with too many `useState` hooks or props |
| `mixed_responsibilities` | 10 | A file mixing UI, data fetching, and business logic |
| `orphaned_export` | 8 | Exported symbols never imported anywhere else — likely AI-generated dead code |
| `deep_nesting` | 8 | Control flow nested beyond 4 levels |
| `long_function` | 8 | Functions longer than 50 lines |
| `missing_error_handling` | 6 | `await` calls without surrounding try/catch |
| `too_many_imports` | 5 | More than 12 imports in one file |
| `console_log` | 3 | `console.log` / `console.error` left in source |
| `todo_comment` | 2 | TODO / FIXME / HACK comments |

### Python-specific

| Rule | Penalty | What it catches |
|------|:-------:|----------------|
| `bare_except` | 8 | `except:` or `except Exception: pass` that swallows errors silently |
| `mutable_default_arg` | 8 | Mutable default argument (`def f(x=[])`) shared across every call |
| `wildcard_import` | 5 | `from module import *` that pollutes the namespace |
| `print_statement` | 3 | Leftover `print()` debugging statements |

Several shared rules apply to Python too (`hallucinated_import` against `requirements.txt`/`pyproject.toml`, `file_too_large`, `long_function`, `deep_nesting`, `too_many_imports`, `god_object`, `todo_comment`).

---

## Live review in Claude Code (MCP)

Keel ships an MCP server so Claude can review its own output as it writes. Add it to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "keel": {
      "command": "keel",
      "args": ["mcp"]
    }
  }
}
```

This exposes five tools: `keel_review_file`, `keel_review_files`, `keel_scan_project`, `keel_semantic_review`, and `keel_list_rules`. Claude calls them right after editing a file to self-correct before moving on.

`keel_semantic_review` (and the `keel judge` command) run an LLM-as-judge pass that catches logic bugs, misleading names, comment rot, and security smells that structural rules miss. It requires `ANTHROPIC_API_KEY` in the environment.

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
├── cli         — keel commands + MCP server + semantic judge
└── ui          — React + Vite dashboard
```

Data is stored in `.keel/keel.db` (SQLite, local to each project, gitignored).

---

## Requirements

- Node 18+
- [Claude Code](https://claude.ai/code)

## Contributing

```bash
git clone https://github.com/ansh0108/keel
cd keel
pnpm install && pnpm build
```

---

## License

MIT
