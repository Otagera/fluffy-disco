# Scouting & Consistency Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement player consistency in the match engine and a scouting system with visibility levels (Fog of War) for player attributes.

**Architecture:** We will add a `consistency` trait to players that scales the standard deviation of Gaussian performance rolls. The scouting system will use a new table to track knowledge levels (0-2) for each player per manager team, with daily progression towards full knowledge.

**Tech Stack:** Svelte 5, Drizzle ORM, TypeScript

---

### Task 1: Schema and Type Updates

**Files:**
- Modify: `src/lib/data/schema.ts`
- Modify: `src/lib/data/types.ts`

**Step 1: Add consistency to schema**
Add `consistency: integer('consistency').notNull().default(10)` to the `players` table in `schema.ts`.

**Step 2: Create scouting_reports table**
Add `scoutingReports` table to `schema.ts`: `id` (text PK), `teamId` (text FK), `playerId` (text FK), `level` (integer), `progressDays` (integer).

**Step 3: Update TypeScript types**
Update `PlayerProfile` to include `consistency` in `hiddenTraits`. Add `ScoutingReport` interface.

**Step 4: Commit**
```bash
git add src/lib/data/schema.ts src/lib/data/types.ts
git commit -m "feat: add consistency and scouting schema"
```

---

### Task 2: Match Engine Consistency

**Files:**
- Modify: `src/lib/engine/Match.svelte.ts`

**Step 1: Calculate Consistency Multiplier**
Inside the shooting and passing logic, calculate a multiplier based on the player's consistency trait.
```typescript
const consistency = stats.consistency || 10;
const consistencyMultiplier = 1.0 + (10 - consistency) * 0.05;
```

**Step 2: Apply to Gaussian rolls**
Scale the `errorSpread` by this multiplier in all `MathUtils.nextGaussian` calls.

**Step 3: Commit**
```bash
git add src/lib/engine/Match.svelte.ts
git commit -m "feat: integrate player consistency into match engine"
```

---

### Task 3: Daily Scouting Progression

**Files:**
- Modify: `src/lib/data/store.ts`

**Step 1: Implement `advanceScouting(save)`**
Add logic to `advanceOneDay` to increment `progressDays` for all active scouting reports.
- 3 days -> level 1
- 7 days -> level 2
Trigger an inbox message when a level increases.

**Step 2: Update `generatePlayer`**
Assign a random consistency value (1-20) during player generation.

**Step 3: Commit**
```bash
git add src/lib/data/store.ts
git commit -m "feat: implement daily scouting progression"
```

---

### Task 4: UI Fog of War and Scouting Actions

**Files:**
- Modify: `src/lib/components/PlayerModal.svelte`
- Modify: `src/routes/teams/[id]/+page.server.ts`

**Step 1: Hide attributes based on level**
In `PlayerModal.svelte`, show `?` for level 0, ranges for level 1, and exact values for level 2 (or if the player is on the manager's team).

**Step 2: Add "Assign Scout" action**
Implement a form action to create a new scouting report entry.

**Step 3: Commit**
```bash
git add src/lib/components/PlayerModal.svelte src/routes/teams/[id]/+page.server.ts
git commit -m "feat: implement fog of war UI and scouting actions"
```
