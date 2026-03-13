# Football Sim Architecture & Onboarding Guide

Welcome to the Football Sim codebase! This document is designed to onboard new developers and AI agents quickly. It covers the core design philosophies, directory structures, database schemas, and the inner workings of the Match Engine.

## 1. System Overview

**Stack:**
- **Frontend Framework:** SvelteKit (using Svelte 5 Runes `$state`, `$derived`, `$effect`).
- **Rendering:** PixiJS v8 (for 2D/3D-projected match visualization).
- **Styling:** Tailwind CSS.
- **Relational Database (Server-side):** SQLite via Better-SQLite3 and Drizzle ORM.
- **Client-side Storage:** IndexedDB via Dexie.js (used exclusively for storing massive binary match replay files).
- **Concurrency:** Web Workers (used for running the match simulation loop off the main thread).

**Core Philosophy:**
The project separates the **Simulation** from the **Presentation**. The match engine computes math rapidly in a headless Web Worker, adhering to Data-Oriented Design (Zero Garbage Collection) principles. The UI merely reads the state and renders it.

---

## 2. Directory Structure

```text
src/
├── lib/
│   ├── components/      # Svelte UI elements (FormationBoard, PlayerModal, SkipModal, etc.)
│   ├── data/            # Database schema, Drizzle connections, Dexie setup, and data generators
│   ├── engine/          # The heart of the game: The Match Engine
│   │   ├── ai/          # Tactics, Formation logic, Spatial Influence Map
│   │   ├── core/        # MathUtils, MatchMemory (Float32Arrays), Constants
│   │   ├── physics/     # Steering behaviors, Ball kinematics (Magnus effect)
│   │   ├── worker/      # Web Worker execution wrapper (`match.worker.ts`)
│   │   ├── Match.svelte.ts           # The pure TS headless simulation class
│   │   ├── MatchController.svelte.ts # Main-thread bridge managing the Web Worker
│   │   └── MatchRecorder.ts          # Serializes memory buffers to binary for replays
│   └── renderer/        # PixiJS application wrapper (`PixiApp.ts`)
├── routes/              # SvelteKit Pages (Dashboard, Inbox, Match, Scouting, Tactics)
└── scripts/             # CLI utilities (e.g., parsing binary replay files)
```

---

## 3. Database Architecture

We use a local SQLite file (`data/savegame.db`). The schema is defined in `src/lib/data/schema.ts`.

### Core Tables:
- **`gamestate`**: Singleton table holding the `currentDate`, `managerTeamId`, and active calendar week.
- **`teams`**: Club data (reputation, overall rating, tactical style, mentality, custom formation/role overrides).
- **`players`**: Individual stats. Attributes are stored as a JSON object (finishing, tackling, pace, etc.). Includes `condition` (stamina) and `morale`.
- **`scouting_reports`**: Tracks the manager's knowledge of players. Uses an "Attribute Fog" system (`level`: 0=Unknown, 1=Range, 2=Exact). For Level 1, `perceivedMin` and `perceivedMax` store the fake range shown to the user.
- **`fixtures` & `fixture_goals`**: The league calendar and historical match results.
- **`inbox_messages` & `league_news`**: Career mode storytelling and transfer negotiations.

**Binary Storage (Dexie):**
Storing 50,000 frames of float arrays per match in SQLite is too slow. `src/lib/data/dexie.ts` manages IndexedDB on the client to store `.bin` files (`Float32Array` buffers) representing match replays.

---

## 4. The Match Engine (D.O.D)

To achieve 100x simulation speeds without freezing the UI, the engine is built on **Data-Oriented Design (DOD)** using flat typed arrays.

### Memory Layout (`src/lib/engine/core/constants.ts`)
We avoid instantiating thousands of JavaScript objects per frame.
- **`playerBuffer` (Float32Array):** Stores all 22 players. Each player takes exactly 11 floats (`PLAYER_STRIDE = 11`).
  `[X, Y, VX, VY, MAX_SPEED, MAX_FORCE, MASS, STAMINA, GK_X, GK_Y, GK_Z]`
- **`ballBuffer` (Float32Array):**
  `[X, Y, Z, VX, VY, VZ, MASS, FRICTION, SPIN_X, SPIN_Y]`

### The Simulation Loop (`Match.svelte.ts`)
1. **Tactics & AI:** `TacticalManager` (`ai/Tactics.ts`) determines if a team is in possession, defending, or transitioning. It calculates an ideal target `(x, y)` for every player based on their role (e.g., Inverted Winger cuts inside, BWM stays back).
2. **Spatial Map:** `SpatialMap.ts` divides the pitch into a grid and calculates control zones based on player proximity.
3. **Decisions:** The engine evaluates pass targets vs. shot quality based on pressure and attributes.
4. **Physics:** `PhysicsEngine` (`physics/Steering.ts`) moves players towards their targets using "Seek" and "Arrive" steering behaviors, enforcing stamina drain and max speeds. It applies gravity, friction, and the **Magnus Effect** (spin curve) to the ball.
5. **Collisions & Goals:** Checks boundaries, throw-ins, and calculates Goalkeeper Inverse Kinematics (IK) for physical bounding-box saves.

### Web Worker Concurrency
Because Svelte's reactive `$state` cannot run in a Web Worker, the architecture is split:
- **`match.worker.ts`:** Instantiates the pure `Match` class. Runs a self-adjusting `setTimeout` loop. Periodically calls `postMessage` to send a copy of the `playerBuffer` and `ballBuffer` back to the main thread.
- **`MatchController.svelte.ts`:** Runs on the main thread. Owns the Svelte `$state` (Score, Time, Cards). It receives buffers from the worker and proxies user actions (Pause, Sub, Tactics) to the worker via `postMessage`.

---

## 5. UI & Rendering (`PixiApp.ts`)

The `MatchController` receives the raw memory buffers. `PixiApp.ts` simply loops over the buffers at 60FPS using `requestAnimationFrame`.
- It multiplies the engine coordinates (105m x 68m) by a pixel scale (e.g., `* 10` pixels per meter).
- Goalkeeper hands are rendered using the `GK_X, GK_Y, GK_Z` offsets if they are not set to the `-1` sentinel value.

---

## 6. How to Extend the Engine

**Adding a new player attribute:**
1. Add it to `player.attributes` in `schema.ts`.
2. Extract it during `match.setup()` and store it in `Match.svelte.ts`'s `playerStats` array.
3. Factor it into math inside `Match.svelte.ts` (e.g., use `stats.jumping` for headers).

**Adding new tactical roles:**
1. Define the role in `Formations.ts`.
2. Add movement logic for that role in `calculateAnchors()` within `Tactics.ts`.

**Preventing Freezes (The Golden Rule):**
If the engine freezes at 100x speed, it is almost ALWAYS a `NaN` propagation caused by a division by zero in `Steering.ts` or `Match.svelte.ts`. **Always use `Math.max(distance, 0.01)` when dividing by distances.**

---

## 7. Useful Scripts

- `npm run dev`: Start SvelteKit.
- `npm run build`: Type-check and compile.
- `npx drizzle-kit push`: Apply schema changes to `savegame.db`.
- `node scripts/review-replay.js <file.bin>`: Parses a downloaded binary replay to dump xG, goals, player movement distances, and ball physics to the terminal.