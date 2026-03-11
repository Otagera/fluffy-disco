# Scouting System & Player Consistency Design

## Objective
Finalize the "Living World" update by adding depth to player personalities (Consistency) and introducing a strategic "Fog of War" through a comprehensive Scouting System.

## 1. Player Consistency (Personality)
Expand the match engine's resolution logic to account for a player's ability to perform at their peak reliably.

### Data Model
- Add `consistency` (1-20) to `PlayerProfile.hiddenTraits`.
- Update `generatePlayer` to assign a random value (mean 10, standard deviation 3).

### Match Engine Logic (`Match.svelte.ts`)
- Calculate a `consistencyMultiplier` for each player:
  - `multiplier = 1.0 + (10 - consistency) * 0.05`
  - Consistency 20 -> `multiplier = 0.5` (Stable, narrow bell curve).
  - Consistency 1 -> `multiplier = 1.45` (Volatile, wide bell curve).
- Apply this multiplier to the `standardDeviation` in all `MathUtils.nextGaussian` calls:
  - `const errorSpread = baseSpread * consistencyMultiplier;`
  - This affects **Shooting**, **Passing**, and **Tackling**.

## 2. Scouting System ("Fog of War")
Introduce a progression-based information reveal for players on opposing teams.

### Visibility Levels
- **Level 0 (Unknown):** Only Name, Age, Role, and Position are visible. Attributes show as `?`. Market Value is hidden.
- **Level 1 (Observed):** Attributes show as ranges (e.g., `12-16`). Market Value is shown as a broad estimate (e.g., `₦40M - ₦60M`).
- **Level 2 (Fully Scouted):** Exact attributes and true Market Value are revealed.

### Scouting Workflow
- **Assign Scout:** A button on the `PlayerModal` (for non-manager team players).
- **Daily Loop Integration:**
  - `advanceOneDay` tracks active scouting tasks.
  - Progress: 3 days -> Level 1, 7 days -> Level 2.
- **Reporting:**
  - Upon reaching Level 1 or 2, the manager receives an **Inbox Message** from the "Chief Scout".
  - The message includes a "Pros/Cons" summary and a tactical fit score.

### Persistent Knowledge
- Scouting data is stored in a new `scouting_reports` table in the DB.
- Players on the manager's own team are always Level 2.
- Once a player is scouted, the knowledge persists for the remainder of the season.

## 3. Implementation Plan
1. **Schema Update:** Add `consistency` to `players` table and create `scouting_reports` table.
2. **Engine Update:** Integrate `consistencyMultiplier` into Gaussian rolls.
3. **Daily Loop Update:** Implement the daily scouting progress and inbox trigger.
4. **UI Update:** Modify `PlayerModal.svelte` to respect scouting visibility levels and add "Assign Scout" button.
