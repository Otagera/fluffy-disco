# Phase 3: The Transfer Market & Date-Tied Fixtures

## Objective
Implement a functioning transfer economy where players can be bought and sold via the Inbox, and update the scheduling system so that fixtures are tied to specific calendar dates rather than abstract "weeks".

## Root Cause / Analysis
1. **Abstract Time:** Currently, the Daily Progression engine just stops if it's "Saturday" and there is an unplayed match for the current week. To make the calendar feel real, every generated fixture needs a specific `date` (e.g., "2024-08-17"). The engine should only stop if `currentDate === fixture.date`.
2. **Static Squads:** The player can view profiles and see Market Values, but there is no mechanism to actually bid on a player and move them between clubs. We need an asynchronous negotiation system that uses the newly created Inbox.

## Implementation Steps

### Chunk 1: Date-Tied Fixtures
1. **Schema & Types:** 
   - Add `date: text('date')` to `fixtures` in `src/lib/data/schema.ts`.
   - Add `date?: string` to `Fixture` in `src/lib/data/types.ts`.
2. **Fixture Generation (`src/lib/data/generator.ts`):**
   - Update `generateSaveGame` to loop through all generated fixtures and assign a date based on their `week`. If Season starts Aug 1st, Week 1 is the first Saturday, Week 2 is the second Saturday, etc.
3. **Daily Loop Update (`src/lib/data/store.ts`):**
   - Update `advanceOneDay` to check `f.date === save.currentDate` instead of `date.getDay() === 6`.
4. **UI Update (`src/routes/+page.svelte`):**
   - Display `fixture.date` on the "Next Match" card instead of just "Matchday X".

### Chunk 2: Transfers & Negotiations
1. **Transfer Offer UI (`src/lib/components/PlayerModal.svelte`):**
   - If the viewed player is NOT on the manager's team, show a "Make Transfer Offer" button.
   - When clicked, reveal an input to set a bid amount (defaulting to the player's calculated Market Value).
2. **Submit Bid Server Action (`src/routes/teams/[id]/+page.server.ts` & others):**
   - Add a `submitTransferBid` action. 
   - When a bid is submitted, evaluate it instantly against the player's market value. If `bid >= value * 0.9` (for example), it is accepted. Otherwise, rejected.
   - Generate an `InboxMessage` from the selling team to the manager stating the result.
3. **Complete Transfer Action (`src/routes/inbox/+page.server.ts`):**
   - If the bid was accepted, the Inbox message contains a "Complete Transfer" button.
   - When clicked, deduct the transfer fee from the manager's team budget, add it to the AI team's budget.
   - Move the `playerId` from the AI team's array to the manager's team array.