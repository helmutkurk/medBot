---
name: ui-design
description: Use when designing or polishing UI/UX so judges grasp the product in seconds; covers hierarchy, states, responsive layout, accessibility basics, one wow moment and a screenshot check.
---

# ui-design

Author: Claude (Sonnet), 2026-11-21. Demo-first: judges see 3 minutes, not the codebase.

## Before drawing
- Read the agreed contract in `contracts/` and the demo script (`docs/event/demo-script.md`).
- Name the single user, the single job, and the one screen where the value is visible.
- Claim UI paths on the board (see team-sync); one session per file.

## Checklist
1. Hierarchy: one primary action per screen; headline states the outcome, not the feature.
2. Flow: the happy path takes at most 3 clicks from landing to result. Cut other screens.
3. States for every data view: empty, loading, error, partial, success. Reuse
   `app/web/components/states.tsx`; do not leave blank panels or raw stack traces.
4. Responsive: check 375 px and 1280 px widths; no horizontal scroll; tap targets >= 44 px.
5. Accessibility basics: text contrast >= 4.5:1, visible focus ring, labels on inputs,
   alt text or `aria-label` on icons, keyboard-reachable primary action, no color-only meaning.
6. One wow moment: a single visible transformation (input to result) that is
   readable from the back of a room. Large type, short copy, at most one animation.
7. Honesty: any fixture-driven or simulated element carries a visible label such as
   "Sample data". Never present fake output as a working integration.
8. Style: one font stack, one accent color, 8 px spacing grid. Prefer the CSS variables
   in `app/web/app/globals.css`. New dependencies need human approval.
9. Demo data: seed realistic but synthetic content (see data-and-fixtures).

## Acceptance check
- Run the app (`USE_FIXTURES=1 npm run dev` in `app/web`) and walk the happy path.
- Take screenshots at both widths and list their paths in the handoff. Browser automation
  must not run in the managed sandbox: report the command for a human to run outside it
  (AGENTS.md, "Never do").
- Force an error (stop the API) and confirm the error state is readable.
- Run `npm run check` in `app/web` (or `bash app/check.sh`).

## Do not
- Do not use copyrighted assets or real people's photos; use generated or licensed ones.
- Do not spend more than about 20% of UI time on visuals before the flow works end to end.
- Do not hide limitations; list them in the demo notes (demo-polish).

Related: web-dev, app-dev, demo-check, pitch-3min.
