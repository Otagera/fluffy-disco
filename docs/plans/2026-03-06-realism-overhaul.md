# Realism & Product Overhaul Critique (Match Engine, Data, UI)

## 1) Match Engine critique
- **Strength today:** movement and rendering architecture is performant and decoupled.
- **Gap:** tactical layers still collapse to reputation-driven outcomes in season simulation, which flattens identity.
- **Overhaul direction:** split simulation into three pipelines:
  1. **Intent layer** (shape, role duties, pressing triggers),
  2. **Execution layer** (attribute + context checks),
  3. **Outcome layer** (event quality to xG, pass completion, duel wins).
- **Result:** clearer causality from tactics to chance creation.

## 2) Players and teams generation critique
- **Strength today:** broad attribute surface and multi-locale naming support.
- **Gap:** current generation is mostly random around team reputation; squads lack coherent archetypes and age curves.
- **Overhaul direction:**
  - Add league-specific templates for age, wage tier, tactical DNA.
  - Add role archetypes (ball-winning mid, inverted winger, target forward) with weighted trait profiles.
  - Introduce hidden consistency and big-match attributes into long-term outcomes.

## 3) Overall ratings model added in this patch
- Player overall is now computed via **role-specific weighted attributes** plus fitness and age modifiers.
- Team overall is computed from a role-balanced best XI (1 GK, 4 DEF, 3 MID, 3 FWD) rather than full squad average.
- Ratings are recalculated when saves are loaded and after weekly processing.

## 4) UI / page critique
- **Current issue:** team page was static/mock data, disconnected from savegame realism.
- **Patch improvement:** team page now reads generated save data and surfaces team/player OVR.
- **Recommended next pages to feel like a full management sim:**
  - **Recruitment Centre:** scouting reports, shortlists, role-fit heatmaps.
  - **Medical & Sports Science:** injury risk model, workload planner.
  - **Training Week Planner:** session blocks affecting tactical familiarity and condition.
  - **Club Vision screen:** board expectations and manager confidence timeline.

## 5) Re-architecture recommendation (phased)
1. **Domain model hardening:** explicit contracts for MatchEvent, TacticalInstruction, PlayerDevelopmentSnapshot.
2. **Simulation consistency:** unify watched and quick-sim through a shared event engine.
3. **Data realism service:** deterministic seed-based world generation by nation and pyramid.
4. **Presentation system:** componentized design tokens and a broadcast UI system (dark/light skins, accessibility pass).


## 6) Implemented in this iteration
- League-stratified squad generation with tier-specific reputation and ability curves.
- Matchday ordering model: probable XI + realistic 9-man bench with reserve goalkeeper guarantee.
- Quick-sim now blends reputation + team overall + tactical style + mentality for more identity-preserving results.
- Squad Hub visual refresh for readability and reduced dark-theme eye strain.
