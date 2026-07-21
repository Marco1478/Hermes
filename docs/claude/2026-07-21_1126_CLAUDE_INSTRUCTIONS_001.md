# Claude Instructions — Control Center UI Continuation

## Context from Hermes

Hermes pulled Claude's latest `main` commit (`50ec603`) and added a follow-up UI/UX pass on branch `fix/control-center-ui-pass`.

Recent Hermes commit:

```text
c41578a fix: restructure hero as control center
```

Hermes changed the hero from scattered telemetry into a coherent right-side **Control Center / System overview** panel. The hero now has stronger left-side identity, a larger `HERMES` title, a left-aligned command bar, hidden visual-noise terminal overlay, wider page shell, larger page headings, and clearer SOUL.md bridge fallback text.

Important constraint: **do not expand or stuff `SOUL.md` further.** Marco said it is full. Improve the rest of the UI and bridge surfaces instead.

## Operating Rules

- Work chunks in numeric order unless a chunk is blocked and a later chunk is independent.
- Before moving to the next chunk, verify the current chunk with the listed gates.
- Commit autonomously after each verified chunk.
- If blocked by missing user input/config, commit a short blocker note/status artifact explaining exactly what is missing, then continue to the next independent chunk.
- Do not expose secrets, tokens, env values, or private paths beyond safe placeholders.
- Do not mark anything complete without real build, browser, or API evidence.

## CLAUDE-001 — Sync and inspect Hermes control-center branch

**Objective:**
Start from the pushed Hermes UI pass and understand the current visual structure before editing.

**Files likely involved:**

- `src/components/Hero.jsx`
- `src/components/Hero.css`
- `src/components/hero/HeroSidebar.jsx`
- `src/components/hero/HeroSidebar.css`
- `src/components/CommandBar.css`
- `src/components/PageShell.css`
- `src/components/hermes/HermesPage.jsx`
- `src/components/hermes/HermesPage.css`

**Verification gate:**

- Pull/fetch latest remote branches.
- Check out `fix/control-center-ui-pass` or rebase equivalent work onto latest `main` if needed.
- Run `npm run build`.
- Launch the UI locally and visually inspect hero + tabs before modifying.

**Commit rule:**
No commit required if this is inspection only. If branch sync/rebase creates changes, commit with a clear `chore:` message after build passes.

## CLAUDE-002 — Turn empty dashboard states into useful diagnostic cards

**Objective:**
When dashboard/gateway data is missing, the UI must not look empty or broken. Replace bare messages like `Dashboard not configured`, `Gateway bridge not configured`, and similar fallbacks with compact diagnostic cards.

**Implementation notes:**

- Do not add content to `SOUL.md`.
- Add visual cards explaining what data is unavailable and what config/bridge endpoint is needed.
- Keep tone concise and technical.
- The empty state should feel intentional: status, reason, next action.

**Verification gate:**

- Simulate/currently observe missing dashboard data.
- Confirm Hermes / Jobs / Tools pages remain readable and structured.
- Confirm no new JS errors in browser console.
- Run `npm run build`.

**Commit rule:**
Commit when verified:

```text
fix: improve dashboard empty states
```

If blocked by unknown env names or bridge contract, commit a note under `docs/claude/status/` describing the missing contract.

## CLAUDE-003 — Refine hero control panel data hierarchy

**Objective:**
Make the hero feel like a real operational command surface, not decoration.

**Implementation notes:**

- Keep one coherent right-side control panel.
- Prioritize readable live status over ornamental widgets.
- If machine/platform/session data cannot load, show clear degraded-state labels.
- Avoid floating telemetry outside the panel.
- Keep the command bar aligned with the identity block.

**Verification gate:**

- Visual QA desktop: no overlap among title, command bar, portrait, and control panel.
- Visual QA narrow/mobile: panel does not crush the hero or become unusable.
- Check interactive links: `details →`, `tools →`, `chat →`.
- Run `npm run build`.

**Commit rule:**
Commit when verified:

```text
fix: refine hero control panel hierarchy
```

## CLAUDE-004 — Control-center pass for Hermes / Jobs / Tools tabs

**Objective:**
Make non-chat tabs feel like parts of the same control center.

**Implementation notes:**

- Increase section rhythm and card hierarchy where needed.
- Make tab labels and page titles legible on desktop.
- Prefer consistent grid/card primitives over one-off layouts.
- Do not introduce heavy UI libraries unless absolutely justified.

**Verification gate:**

- Inspect `Hermes`, `Jobs`, and `Tools` tabs in browser.
- Confirm no header collision with BrandMark.
- Confirm no horizontally clipped controls on desktop and mobile widths.
- Run `npm run build`.

**Commit rule:**
Commit when verified:

```text
fix: align control-center tab layouts
```

## CLAUDE-005 — Final verification report

**Objective:**
Leave Marco and Hermes a short factual status report.

**Required report content:**

- Branch name and latest commit SHA.
- What changed visually.
- What works.
- What is still blocked or needs Marco input.
- Exact commands run for verification.

**Verification gate:**

- `git status --short --branch` is clean.
- `npm run build` passes.
- Browser console has no application errors.

**Commit rule:**
Commit the report under `docs/claude/status/` if useful, otherwise include it in the final Claude response. Do not fake browser/API results.
