# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git & GitHub

**Commit and push after every meaningful unit of work** — a new feature, a bug fix, a refactor, or any change worth preserving. Do not batch up multiple sessions of work into a single vague commit. The goal is that GitHub always reflects the current state of the project so work is never lost and any change can be reverted cleanly.

Workflow for every change:

```
git add <specific files>
git commit -m "subject line

optional short body explaining why"
git push
```

Commit message rules:
- Subject line: short, imperative ("Add X", "Fix Y", "Remove Z") — not past tense
- Body (optional): explain *why*, not *what* — the diff already shows what changed
- Never use `git add -A` or `git add .` — stage specific files by name

Remote: https://github.com/Spencertech95/tictactoe

## Project Structure

This is a self-contained, no-build web project. Everything runs directly in the browser — no bundler, no package manager, no server required.

| File | Purpose |
|------|---------|
| `tictactoe.html` | Entire app: HTML structure, CSS styles, and JS game logic in one file |

## Architecture

`tictactoe.html` is organized into three inline sections:

- **CSS** (`<style>`) — dark theme layout using CSS Grid for the 3×3 board, transitions, and a `pulse` animation for winning cells
- **HTML** — board container (`#board`), status line, restart/mode buttons, scoreboard
- **JavaScript** (`<script>`) — all game logic:
  - `board[]` (9-element array), `current` player, `over` flag, `vsComputer` toggle, `scores` object
  - `move(i)` — central handler: updates state, checks win/draw, triggers computer turn
  - `checkWin(player)` — tests all 8 winning combos from the `WINS` constant
  - `minimax(b, player)` — recursive minimax for unbeatable AI (called only when `vsComputer` is true)
  - `render()` — rebuilds the board DOM from scratch on every state change

## Running

Open `tictactoe.html` directly in a browser:

```
start tictactoe.html   # Windows
```

No build step needed.
