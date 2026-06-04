# Keel

**Code quality analyzer for AI-generated TypeScript, JavaScript, and Python.**

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

# 2. Baseline scan of all existing TS/JS/Python files
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
3. Each changed file is scored against the quality rules for its language (TS/JS or Python)
4. `keel ui` opens a local dashboard at `localhost:2701`

No CI, no cloud, no accounts. Everything stays on your machine.

---

## Commands

| Command | What it does |
|---|---|
| `keel init` | Injects Claude Code hooks, registers the MCP server, creates `.keel/` dir |
| `keel scan` | One-shot baseline scan of all TS/JS/Python files |
| `keel ui` | Starts the dashboard at `localhost:2701` |
| `keel mcp` | Runs Keel as an MCP server (stdio) for live, in-session code review |
| `keel report [session]` | Agent report card for a session — grade, score trajectory, what broke vs. what got fixed |
| `keel blame [filter]` | "git blame" for quality regressions — which edit dropped a file's score, and why |
| `keel judge <file>` | Semantic LLM review of one file (naming, logic, comment rot, security) |
| `keel record` | Called automatically by hooks — records events and analyzes files |
| `keel validate` | Called automatically at session end — validates saved constraints |

---

## Live review (MCP server)

Beyond passive recording, Keel runs as a **Model Context Protocol server** so Claude Code can review its own code *during* a session and self-correct before finishing — instead of finding out after the fact.

`keel init` registers it automatically in your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "keel": { "command": "keel", "args": ["mcp"] }
  }
}
```

Restart Claude Code and these tools become available:

| Tool | What it does |
|---|---|
| `keel_review_file` | Score one file and return line-level issues with fixes |
| `keel_review_files` | Review a batch of files at once |
| `keel_scan_project` | Whole-project health report: overall score + worst files |
| `keel_semantic_review` | Deeper LLM review of one file — logic, naming, comment rot, security (needs `ANTHROPIC_API_KEY`) |
| `keel_list_rules` | List every rule, what it catches, and its penalty |

Now Claude can write a file, call `keel_review_file` on it, and fix any hallucinated imports or dead code **before moving on** — closing the quality loop in real time. The server re-reads `package.json` and project source on every call, so freshly installed deps and just-edited files are always reflected.

---

## Quality rules

Keel routes each file to its language's rule set by extension. Both languages share a
structural core; each adds checks for the failure modes specific to it.

**TypeScript / JavaScript** (`.ts` `.tsx` `.js` `.jsx`):

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
| `hallucinated_import` | Imports of packages not installed or listed in `package.json` (likely AI-hallucinated) |
| `orphaned_export` | Exported symbols never imported anywhere else (likely AI-generated dead code) |

**Python** (`.py` `.pyi`):

| Rule | What it catches |
|---|---|
| `file_too_large` | Files over 300 lines |
| `long_function` | Functions over 50 lines |
| `deep_nesting` | Indentation nested over 4 levels |
| `too_many_imports` | More than 12 imports |
| `god_object` | Classes with too many methods |
| `todo_comment` | TODO / FIXME / HACK / XXX comments |
| `hallucinated_import` | Imports not in the stdlib, any dependency manifest, or the local project (likely AI-hallucinated) |
| `bare_except` | `except:` (or `except Exception: pass`) that swallows errors silently |
| `mutable_default_arg` | `def f(x=[])` — a default mutable shared across calls |
| `print_statement` | Leftover `print()` debugging statements |
| `wildcard_import` | `from module import *` namespace pollution |

Each file gets an **overall score from 0–100**. Errors lower the score more than warnings.

---

## Semantic review (LLM-as-judge)

Structural rules catch *shape* problems. They can't see a misleading function name, a comment that lies about the code, a swallowed error, or an off-by-one in edge-case handling. `keel judge` adds a **semantic tier** on top: it sends a file to an LLM acting as a senior reviewer and returns line-level findings for the issues a linter structurally cannot detect.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
keel judge src/auth/session.ts
```

```
Semantic review of src/auth/session.ts (claude-haiku-4-5) — 2 findings:
  [ERROR] security:42 — token compared with == allows type-juggling bypass
         fix: use a constant-time comparison (crypto.timingSafeEqual)
  [WARN] comment-accuracy:88 — comment says "retries 3×" but loop runs twice
         fix: update the comment or the loop bound to match
```

It's opt-in: with no `ANTHROPIC_API_KEY` set it prints a clear notice and does nothing — no surprise network calls. Model defaults to `claude-haiku-4-5`; override with `KEEL_JUDGE_MODEL`. The same review is available to Claude Code in-session via the `keel_semantic_review` MCP tool.

---

## Report card

After a session, `keel report` grades the agent's work: where the code started, where it ended, what it broke, and what it fixed.

```bash
keel report            # latest session
keel report <id>       # a specific session
```

```
  Keel Report Card — session 1831cd17
  ────────────────────────────────────────────
  Grade:        A-   (avg 91/100)
  Trajectory:   100/100 → 88/100  (-12)
  Files touched: 7   ·   Analyzed edits: 14
  Issues:        9 total · 4 resolved · 2 regressions
  AI slop:       1 hallucinated import(s) · 0 orphaned export(s)
```

Letter grade, score trajectory, top offending rules, lowest-scoring files, and a one-line verdict — a quick read on whether a coding session left the codebase better or worse.

---

## Regression blame

`keel blame` is **git blame for code quality**. It walks the recorded history, finds every point where a file's score dropped, and attributes the drop to the exact edit that caused it — listing the specific violations that edit introduced.

```bash
keel blame                 # every regression across all sessions
keel blame session.ts      # only files matching "session.ts"
```

```
  src/auth/session.ts
    92 → 70 (-22)  via file_edit at 5/29/2026, 4:12:07 PM
    node 7f3a…e91
    + [error] hallucinated_import:1 — import of unknown package 'jwt-magic'
    + [warning] console_log:44 — console.log left in source
```

No more guessing which change tanked a file — Keel points at the edit and the reason.

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
