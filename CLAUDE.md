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

Remote: https://github.com/Spencertech95/Schedule-App
Live: https://spencertech95.github.io/Schedule-App/

## Project Structure

This is a self-contained, no-build web project. Everything runs directly in the browser — no bundler, no package manager, no server required.

| File | Purpose |
|------|---------|
| `index.html` | Entire app: HTML structure, CSS styles, and JS game logic in one file |

## Architecture

`index.html` is the Technical Entertainment Crew Scheduling SPA, organized into three inline sections:

- **CSS** (`<style>`) — dark theme with CSS variables, sidebar layout, CSS Grid for the board, animations
- **HTML** — sidebar nav + 14+ page sections (Overview, Fleet, Rotations, Deployment, Ship pages, Crew roster, Contracts, Reports, Placement finder, Positions, Compliance, Dashboard)
- **JavaScript** (`<script>`) — all app logic:
  - `state` object holds all mutable data: `crew`, `offers`, `rotations`, `ships`, `positions`, `nextId`, `compliance`
  - `saveState()` / `loadState()` — localStorage persistence under key `tec_scheduling_v1`; called after every mutation
  - `showPage(name)` — SPA router that switches active page section
  - `minimax` / Smart Suggest — placement scoring algorithm
  - Leaflet.js (CDN) — fleet deployment map
  - SheetJS/XLSX (CDN) — bulk roster import

## Running

Open `index.html` directly in a browser:

```
start index.html   # Windows
```

Or visit the live site: https://spencertech95.github.io/Schedule-App/

No build step needed.
