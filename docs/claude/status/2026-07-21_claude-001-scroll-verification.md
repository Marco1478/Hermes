# CLAUDE-001 — System Overview scroll: verified, not a real bug

Responding to `docs/claude/2026-07-21_1655_CLAUDE_INSTRUCTIONS_003.md`, chunk
CLAUDE-001 ("Known UI issue to fix first").

## Finding

The reported symptom does not reproduce. `PageShell` (used by System/Jobs/
Hermes/Tools) already has a correct internal scroll region:

```
.page-shell   { height: 100%; display: flex; flex-direction: column; }
.page-header  { flex: none; }
.page-scroll  { flex: 1; min-height: 0; overflow-y: auto; }  /* the real
                                                                 scroll container */
.page-constrain { display: flex; flex-direction: column; gap: 1.75rem; }
```

Verified live (own dev server, System Overview, viewport 1280x720):

- `.page-scroll` has real overflow: `scrollHeight` 1222 vs `clientHeight` 627
  (≈595px of hidden content).
- Setting `.page-scroll.scrollTop = scrollHeight` moves the container to its
  max and brings `.overview-sessions` ("Recent Sessions", the section named
  in the bug report) fully into the 0–720 viewport
  (`getBoundingClientRect()` → top 614 / bottom 656, both inside bounds).
- No ancestor clips it: no `overflow: hidden` between `.page-scroll` and its
  content, no `touch-action` or wheel `preventDefault` anywhere in
  `PageShell.jsx`. A real mouse-wheel/trackpad scroll is not intercepted.

## Why the verification gate as literally written can't pass

The instructions' suggested check —
`document.documentElement.scrollHeight > window.innerHeight` — will **never**
be true in this app, by design, not by bug: `#root` and `.view` are
`position: fixed; inset: 0` (global.css) so the hero can be a true full-bleed
video viewport. A fixed-position element is removed from normal document
flow, so it never contributes to `document.documentElement.scrollHeight`
regardless of how much content a page renders. Every non-hero page scrolls
internally via `.page-scroll`, not via the document — that's the existing,
working pattern (Jobs/Hermes/Tools already rely on it, not just System).

Rearchitecting so plain document scroll works instead (making `#root`
non-fixed except for the hero) would be a real, non-trivial change touching
every view including Chat's own internal layout, to fix something that isn't
actually broken. Skipped as unnecessary risk — see project guidance against
refactoring beyond what a task needs.

## Conclusion

No code change made for this chunk. `.page-scroll` already satisfies the
actual requirement ("lower cards are reachable by scrolling"); only the
suggested document-level probe was a false positive. If a real clipping bug
resurfaces, check for a new `overflow: hidden` / fixed-height ancestor
introduced between `.page-scroll` and the clipped content rather than
re-litigating this container.

## Commands / checks run

```js
document.querySelector('.page-scroll').scrollHeight   // 1222
document.querySelector('.page-scroll').clientHeight    // 627
// scrollTop = scrollHeight -> .overview-sessions rect fully inside viewport
```

Own isolated `vite --port 5237` instance used for this check (port 5199 was
occupied by a concurrent session's dev server).
