# Dou Dizhu Farmer Hand Rows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the duplicate play-history panel and show every farmer card in fixed rows of at most nine cards.

**Architecture:** Keep the existing `hands[seat]` arrays and original card order. For farmer seats only, split the array into chunks of nine and render each chunk with the existing `Hand` component; landlord rendering and all game state remain unchanged.

**Tech Stack:** Next.js 13, React 18, TypeScript, CSS Modules

---

### Task 1: Render fixed farmer rows

**Files:**
- Modify: `games/ddz/renderer.tsx`
- Modify: `games/ddz/renderer.module.css`

1. Split farmer hands with `slice(0, 9)` and `slice(9, 18)`.
2. Render one or two row containers while preserving original indices and east-seat direction.
3. Remove farmer horizontal scrolling and size the seat panels for two rows.
4. Keep the south landlord hand and human interaction behavior unchanged.

### Task 2: Remove duplicate play history

**Files:**
- Modify: `games/ddz/renderer.tsx`

1. Delete the standalone `Section title="出牌"` block below the table.
2. Keep `plays` state and the table-center recent-play rendering unchanged.

### Task 3: Verify

**Files:**
- Verify: `games/ddz/renderer.tsx`
- Verify: `games/ddz/renderer.module.css`

1. Run `npm.cmd run build`; expect success.
2. Run a local game and confirm a 17-card farmer hand renders as 9 + 8 without a scrollbar.
3. Confirm the standalone play-history section is absent and the center trick remains visible.
