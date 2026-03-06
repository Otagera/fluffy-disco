# Football Simulation Engine (v2)

A high-performance, statistically driven 2D football management and match simulation overhaul. This version implements a modern, light-themed UI system built with Svelte 5 and Tailwind CSS, backed by a Data-Oriented Design (DOD) match engine.

## Core Pillars

1.  **High-Fidelity UI/UX:** A comprehensive UI overhaul using Tailwind CSS, featuring a clean light theme, shared tactical components, and interactive drag-and-drop management.
2.  **Unified Tactical System:** A shared `FormationBoard` component used for global strategy, pre-match fine-tuning, and in-match substitutions with full drag-and-drop support.
3.  **Realism-Driven Data:** League-stratified player generation with realistic squad numbers, role-specific weighted attributes, and age-based development curves.
4.  **Decoupled Simulation Engine:** Pure TypeScript simulation utilizing `Float32Array` for state, supporting headless batch simulations and high-speed outcomes.
5.  **Biomechanical Steering:** Movement governed by Craig Reynolds' steering behaviors (Seek, Arrive, Separation) for fluid, lifelike player motion.
6.  **WebGL Rendering:** A PixiJS pipeline renders 22+ players at a consistent 60FPS using raw memory buffers.

## UI & Management Features

-   **Dashboard Hub:** Interactive standings with expanded modal views, fixture management, and career lifecycle control.
-   **Tactical Sandbox:** Free-form position dragging and role assignments saved as permanent club defaults or match-specific overrides.
-   **Squad Hub:** Deep-dive into every club's roster with color-coded ratings, starting XI projections, and detailed player attribute radars.
-   **Career Control:** High-fidelity managerial actions including a professional "Terminate Career" confirmation system.

## Architecture

```text
src/
├── lib/
│   ├── components/       # Shared UI (FormationBoard, PlayerModal, HUD)
│   ├── engine/           # Pure TS Simulation (No Svelte Runes)
│   │   ├── ai/           # Spatial Maps, Tactics, Decision Making
│   │   ├── core/         # RNG, Memory Buffers, Constants
│   │   └── physics/      # Steering, Kinematics, Collisions
│   ├── data/             # Save Game Store, Realism Generator, Rating Models
│   └── renderer/         # PixiJS WebGL View Layer
└── routes/               # SvelteKit App Pages (Home, Teams, Tactics, Formation)
```

## Tech Stack

-   **Framework:** Svelte 5 (Runes) & SvelteKit
-   **Styling:** Tailwind CSS (v3)
-   **Rendering:** PixiJS (WebGL)
-   **Logic:** TypeScript
-   **Mocking:** Faker.js (Localization-aware generation)

## Performance Targets
-   **Simulation:** 100+ match simulations in under 5 seconds.
-   **Visuals:** 60FPS WebGL rendering with zero framework overhead in the match loop.
-   **Efficiency:** Zero GC pressure via pre-allocated TypedArrays.
