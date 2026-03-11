# Scouting & Transfer Hub Design

## Goal
Implement a central hub for player discovery, evaluation, and recruitment management. This hub integrates the previously implemented "Fog of War" scouting system with a global player database and a private watchlist.

## Architecture & Components

### 1. Route: `/scouting`
A new top-level route containing a tabbed interface:
- **"Search" Tab:** Global discovery of all players.
- **"Shortlist" Tab:** Management of evaluated targets and active scouting.

### 2. Global Player Search
- **Data Fetching:** Paginated server-side search (50 players per page).
- **Public Visibility:** Name, Age, Team, Position, and **Season Stats** (Goals, Assists, etc.) are visible for all players.
- **Fog of War Visibility:** Technical attributes are hidden/masked based on `scoutingLevel`:
    - **Level 0 (Unscouted):** Displays `?`.
    - **Level 1 (Basic):** Displays ranges (e.g., `12-16`).
    - **Level 2 (Full):** Displays exact values.
- **Filters:** Search by Name, Position, Age Range, and "Fully Scouted" status.

### 3. The Shortlist Hub
- **Persistence:** A list of `shortlistedPlayerIds` stored in the `SaveGame` object.
- **Scouting Slots:** A manager has **5 Active Scouting Slots**.
- **Management:** Users can toggle "Priority Scouting" on up to 5 shortlisted players.
- **Daily Progression:** Only players in the active slots will gain scouting progress during the `advanceOneDay` loop.
- **Comparison Tool:** A "Compare with Squad" button that pulls up a side-by-side view of the target vs. the user's current top player in that role.

## Data Model Updates
- **`SaveGame` Interface:** Add `shortlist: string[]`.
- **`ScoutingReport` Interface:** Ensure it has an `isPriority: boolean` flag to track the 5 active slots.

## User Experience (UX)
- **Continue Button logic:** If a scouting report is completed, the "Continue" button on the dashboard will stop and alert the user to check the hub.
- **Quick Action:** Every `PlayerModal` will now have a "Add to Shortlist" toggle.

## Implementation Plan
1. **Step 1:** Update `SaveGame` and `ScoutingReport` types/schema.
2. **Step 2:** Scaffold the `/scouting` route and tabbed layout.
3. **Step 3:** Implement the paginated server-side search logic.
4. **Step 4:** Build the Shortlist management UI and the "5 Slot" constraint logic.
5. **Step 5:** Integrate the Comparison tool into the hub.
