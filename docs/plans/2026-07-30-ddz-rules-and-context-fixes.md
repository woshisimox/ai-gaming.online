# Dou Dizhu Rules and Context Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every Dou Dizhu game request isolated, provide algorithms with complete public game history, enumerate all legal plays, reject illegal state transitions, and terminate immediately when any player empties their hand.

**Architecture:** Keep all per-game state inside `runOneGame` and pass its cloned context unchanged through the stream wrapper. Build LLM prompts from the full ordered history and public-card fields. Strengthen both the production stream and generic engine at their state-transition boundaries, then cover the rules with a lightweight Node regression script.

**Tech Stack:** TypeScript, Next.js API routes, Node.js assertions, TypeScript transpilation for regression tests.

---

### Task 1: Isolate algorithm context per game

**Files:**
- Modify: `pages/api/stream_ndjson.ts`
- Test: `scripts/test-ddz-rules.cjs`

**Steps:**
1. Remove process-global seen-card caches.
2. Preserve the engine-provided `seen`, `seenBySeat`, `bottom`, and `history`.
3. Verify two contexts cannot overwrite one another.

### Task 2: Send complete public history to LLM algorithms

**Files:**
- Modify: `lib/bots/util.ts`
- Test: `scripts/test-ddz-rules.cjs`

**Steps:**
1. Format the full ordered history instead of the last six actions.
2. Include full bottom cards, per-seat played cards, remaining counts, and current trick.
3. Include the same game information in fallback prompt modes.
4. Assert early and late history events both appear in generated prompts.

### Task 3: Enumerate all legal attachment combinations

**Files:**
- Modify: `lib/doudizhu/engine.ts`
- Test: `scripts/test-ddz-rules.cjs`

**Steps:**
1. Add deterministic combination helpers.
2. Generate every legal triple attachment, airplane wing, and four-with-two attachment.
3. Deduplicate moves by physical card identity.
4. Assert representative alternative attachments are present.

### Task 4: Reject illegal generic-engine actions

**Files:**
- Modify: `games/ddz/game.ts`
- Test: `scripts/test-ddz-rules.cjs`

**Steps:**
1. Reject passing when leading or when no active requirement exists.
2. Reject plays that do not beat the active combination.
3. Preserve immediate terminal state when a valid play empties the hand.

### Task 5: Enforce terminal events end to end

**Files:**
- Modify: `lib/doudizhu/engine.ts`
- Modify: `pages/api/stream_ndjson.ts`
- Test: `scripts/test-ddz-rules.cjs`

**Steps:**
1. Attach the remaining hand snapshot to each production play event.
2. Track the terminal seat in the stream layer and suppress any later play event.
3. Ensure the engine emits a winner and returns immediately after the empty-hand play.
4. Assert no bot is called after a player empties their hand.

### Task 6: Verify

**Files:**
- Modify: `package.json`

**Steps:**
1. Run `npm run test:ddz`.
2. Run `npm run build`.
3. Review `git diff --check` and commit only intended source, test, and plan files.
