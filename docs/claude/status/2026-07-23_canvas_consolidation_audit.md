# Canvas consolidation — CLAUDE-001 audit

Reproduced Marco's feedback directly in the browser (not from assumptions)
before touching any code, per `docs/claude/2026-07-23_0934_CLAUDE_INSTRUCTIONS_008.md`.
Test surface: a disposable `_HERMES_UI_SMOKE_TEST_DELETE_ME consolidation`
project/canvas — Marco's real "Portfolio" data was not touched.

## Before — observed failures, with evidence

1. **Horizontal space is not actually fullscreen at real desktop widths.**
   Confirmed via `getBoundingClientRect()`/computed-style inspection at
   1280px and 1600px window widths (screenshots at those sizes are
   unreliable in this environment — see note below — so DOM measurement
   was used instead). Root cause: `.page-constrain--wide` in
   `PageShell.css` caps at `min(96vw, 1760px)`, and more importantly the
   Project Workspace's own sidebar and content area render as **separate
   floating cards** with visible gaps between the global rail, the project
   sidebar, and the content column — not one continuous surface. This
   matches Marco's "awkward empty gap" and "not fullscreen horizontally"
   complaints exactly.

2. **Text gets selected during node drag — reproduced and proven.**
   Dragged a decision node's title area; immediately after,
   `window.getSelection().toString()` returned `"Approve?"` (the node's own
   title) — a real, active native text selection triggered by the drag
   gesture. Root cause: zero `user-select` rules exist anywhere in
   `ProjectCanvas.css` — nothing currently prevents native text selection
   on a pointerdown-drag that starts on top of rendered text.

3. **Drag does not track the cursor exactly.** Measured a node's position
   before and after a precise, known 100×100px screen-space drag (at 100%
   zoom, snap OFF): the node moved **120×121px**, a consistent ~20%
   overshoot in both axes. Likely cause: during an active drag, the node's
   position is driven by *two* mechanisms simultaneously — the committed
   React state (`left`/`top`, updated every tick via `onDrag`) **and**
   framer-motion's own internal `x`/`y` MotionValue (which independently
   tracks the live pointer offset since drag start) — so the same movement
   is being applied twice, compounding into drift instead of 1:1 tracking.

4. **Decision node is unreadable — confirmed visually and via computed
   style.** A fresh decision node rendered as a **solid black diamond**
   with no visible border contrast; the title text sat on top of it barely
   legible against the near-black fill. Computed style showed
   `backdrop-filter: blur(10px)` combined with `clip-path: polygon(...)`
   on the same element — a known class of browser compositing bug where
   `backdrop-filter` fails to composite correctly (renders opaque/near-
   black) when the element is also clipped with `clip-path`. Every other
   node preset uses the same `backdrop-filter`, but only the decision
   node also has `clip-path`, which is why it's uniquely broken.

5. **Quick commands (undo/redo/snap) do functionally work when clicked** —
   confirmed live (undo visibly reverted a drag). Marco's "do not seem to
   work" complaint likely points at weaker issues: unclear visual
   feedback, or specific advertised keyboard shortcuts not firing
   reliably — CLAUDE-005 will audit every command individually (click +
   shortcut + visual feedback + console) rather than spot-check.

6. **Connect UX and remaining "legnosa" feel** — not fully re-audited in
   this pass beyond what's already known from the prior instruction file's
   work (explicit Connect mode exists). CLAUDE-006 will do a dedicated
   pass per the instruction file's own detailed requirements (source
   highlight, valid-target highlight, live preview line, larger hit
   areas).

## Environment note

Screenshots taken at custom window widths above ~900px in this tool render
visually inconsistent with the page's actual DOM geometry (confirmed via
`elementFromPoint` cross-checks — real interactive elements exist well
beyond where the screenshot visually shows content ending). DOM-based
measurement (`getBoundingClientRect`, computed styles, `elementFromPoint`)
was used as ground truth for all width/layout claims above instead of
trusting screenshot appearance at those sizes. Screenshots at the tool's
native/default size remain reliable and were used for visual-only checks
(node contrast, shape rendering).

## Next steps

Proceed to CLAUDE-002 (horizontal fullscreen layout + nav gap) through
CLAUDE-009 in order, using the findings above as the acceptance target for
each corresponding chunk.
