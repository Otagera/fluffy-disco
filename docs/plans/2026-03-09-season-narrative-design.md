# Season Narrative System Design

## Overview
Enhance the League Hub with narrative depth by tracking individual goalscorers (including minutes), generating league-wide news headlines, and highlighting the Golden Boot race.

## 1. Data Model Updates
*   **Fixture Expansion:** Add `goalEvents: GoalEvent[]` to the `Fixture` interface.
    ```typescript
    interface GoalEvent {
      playerId: string;
      minute: number;
      teamId: string;
    }
    ```
*   **League Expansion:** Add `news: NewsItem[]` to the `League` interface.
    ```typescript
    interface NewsItem {
      id: string;
      week: number;
      headline: string;
      type: 'BIG_RESULT' | 'HAT_TRICK' | 'GOLDEN_BOOT' | 'TOP_CLASH';
      relatedPlayerId?: string;
      relatedTeamId?: string;
    }
    ```
*   **Persistence:** Update SQLite schema to include `fixture_goals` and `league_news` tables.

## 2. Simulation & Narrative Logic
*   **Goal Timing:** Update `simFixtures()` to generate a random minute (1-90) for every goal, weighted towards the end of each half.
*   **News Generator:** A new engine that runs after each matchweek to generate headlines:
    *   **Big Result:** Wins by 4+ goals.
    *   **Hat-Trick:** Individual players scoring 3+ goals.
    *   **Golden Boot:** Milestone goals or changes in the league leader.
    *   **Top Clash:** Highlights matches between 1st and 2nd place.
*   **Played Matches:** Extract exact goal minutes from `matchAnalytics.events` and save them to the fixture record.

## 3. UI Implementation
*   **News Snippet:** A compact "Breaking News" section at the top of the League Table tab, including Golden Boot updates.
*   **League News Tab:** A dedicated scrollable timeline of the season's headlines grouped by week.
*   **Detailed Fixtures:** Expandable or detailed rows in the Fixtures tab showing scorers and their minutes (e.g., "J. Smith 42'").
