# Skip To Date & Delegation Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a robust "Skip To Date" system with a hybrid calendar/milestone modal and an "Assistant Manager" delegation feature for silent auto-resolving of urgent events.

**Architecture:** 
- New `SkipModal.svelte` component for target selection and progress tracking.
- Updates to `advanceOneDay` in `store.ts` to accept delegation configuration.
- Enhanced `advanceDay` server action to support delegation flags.
- Silent auto-resolve logic for transfer bids and contract expirations when delegated.

**Tech Stack:** Svelte 5 (Runes), SvelteKit, Drizzle ORM, SQLite.

---

### Task 1: Update Store Logic for Delegation

**Files:**
- Modify: `src/lib/data/store.ts`
- Modify: `src/lib/data/types.ts`

**Step 1: Update types**
Add a `SkipConfig` interface and update `advanceOneDay` signature.

**Step 2: Implement delegation logic in `advanceOneDay`**
Modify `advanceOneDay` to check `skipConfig.delegate`. If true, bypass `mustStop` for `isUrgent` events and call auto-resolve handlers.

**Step 3: Implement `autoResolveBids` and `autoResolveContracts`**
Add helper functions to `store.ts` to handle these events silently (marking them as read or rejecting them).

**Step 4: Commit**
```bash
git add src/lib/data/store.ts src/lib/data/types.ts
git commit -m "feat: add delegation logic to advanceOneDay"
```

---

### Task 2: Update Server Actions

**Files:**
- Modify: `src/routes/+page.server.ts`

**Step 1: Update `advanceDay` action**
Modify the action to accept a `delegate` parameter from the form data.

**Step 2: Commit**
```bash
git add src/routes/+page.server.ts
git commit -m "feat: update advanceDay action for delegation"
```

---

### Task 3: Create SkipModal Component

**Files:**
- Create: `src/lib/components/SkipModal.svelte`

**Step 1: Implement UI**
- Tabs/Sections for "Milestones" and "Pick Date".
- Radio buttons for "Stop on Urgent" vs "Delegate to Assistant".
- Start/Cancel buttons.
- Progress bar and current date display when active.

**Step 2: Implement Logic**
- Calculate dates for milestones (End of Week = Sunday, etc.).
- Handle the advancement loop (calling `fetch('?/advanceDay')` repeatedly).

**Step 3: Commit**
```bash
git add src/lib/components/SkipModal.svelte
git commit -m "feat: create SkipModal component"
```

---

### Task 4: Integrate SkipModal in Home Page

**Files:**
- Modify: `src/routes/+page.svelte`

**Step 1: Add Skip Button**
Replace or complement the "NEXT MATCH" button with a "SKIP TO DATE" button.

**Step 2: Mount `SkipModal`**
Import and add the modal to the layout.

**Step 3: Commit**
```bash
git add src/routes/+page.svelte
git commit -m "ui: integrate SkipModal on home page"
```

---

### Task 5: Summary Reports

**Files:**
- Modify: `src/lib/data/store.ts`

**Step 1: Aggregate actions during skip**
Store delegated actions in a temporary array during the skip loop.

**Step 2: Send summary messages**
At the end of the skip (or daily), send a compiled `InboxMessage` from the "Assistant Manager".

**Step 3: Commit**
```bash
git add src/lib/data/store.ts
git commit -m "feat: add assistant summary reports for delegated actions"
```

---

### Verification & Testing

- **Basic Skip:** Select a date 3 days away. Verify simulation stops on that date.
- **Stop on Urgent:** Assign a scout, skip past the "report complete" date. Verify it stops if the message is urgent (or if it's a match day).
- **Delegation:** Skip past a known urgent event (like a contract expiry) with "Delegate" on. Verify the simulation continues and an Assistant message appears later.
- **Milestones:** Click "End of Week". Verify it targets the correct date.
