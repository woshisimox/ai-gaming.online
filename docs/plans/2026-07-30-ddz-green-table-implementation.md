# Dou Dizhu Green Table Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the three-column hand display with a responsive green table where the landlord is south and the farmers are west and east.

**Architecture:** Keep engine seat IDs unchanged and introduce a presentation-only seat-to-position mapping in the live renderer. Render all three hands, bottom cards, and current trick inside one semantic table component, with CSS module classes controlling table geometry and responsive card scaling.

**Tech Stack:** Next.js 13 Pages Router, React 18, TypeScript, CSS Modules

---

### Task 1: Add presentation seat mapping

**Files:**
- Modify: `games/ddz/renderer.tsx`

1. Add a small typed helper that returns `{ south, west, east }` from the current landlord seat.
2. Use a stable default mapping while no landlord is known.
3. Keep all callbacks and state lookups keyed by original seat ID.
4. Run `npm.cmd run build`; expect TypeScript checks to pass.

### Task 2: Render the green table

**Files:**
- Modify: `games/ddz/renderer.tsx`

1. Replace the existing three-column hand and bottom-card grids with one table shell.
2. Render reusable seat panels for west, east, and south.
3. Keep `Hand` props for human selection, face-down opponents, and reveal timing unchanged.
4. Place bottom cards and the latest trick in the table center.
5. Retain the full play-history section below the table.

### Task 3: Add responsive table styling

**Files:**
- Modify: `games/ddz/renderer.module.css`

1. Add the green felt, gold rail, seat-position, score-badge, center-pot, and compact-farmer classes.
2. Scale farmer hands to roughly 70% without shrinking landlord interactions.
3. Add tablet and mobile media queries that preserve the inverted-triangle layout.
4. Ensure the south hand can scroll horizontally on narrow screens.

### Task 4: Verify behavior and presentation

**Files:**
- Verify: `games/ddz/renderer.tsx`
- Verify: `games/ddz/renderer.module.css`

1. Run `npm.cmd run build`; expect a successful production build.
2. Start the app locally and inspect the table at desktop and mobile widths.
3. Confirm landlord rotation for seats 0, 1, and 2 using live games or fixture state.
4. Confirm human card selection, hidden opponent hands, bottom cards, and play history still work.
5. Commit only the two renderer files and the plan documents.
