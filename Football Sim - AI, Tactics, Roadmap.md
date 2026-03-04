# **Objective Analysis and Strategic Roadmap for a Deep Simulation Football Match Engine**

## **1\. Project Context and the Philosophical Paradigm Shift**

The development of a two-dimensional football simulation engine utilizing Svelte 5, TypeScript, and purely native Inline Scalable Vector Graphics (SVG) represents a highly innovative approach to browser-based game architecture. The current technological foundation—a fixed timestep logic loop of 16.67 milliseconds driven by requestAnimationFrame, coupled with normalized coordinate rendering—provides a stable, deterministic environment. However, the current feature set, which relies heavily on a Finite State Machine (FSM) for Artificial Intelligence and a purely physics-driven resolution model for player interactions, positions the project firmly within the arcade or tactical action genre rather than the deep, statistical simulation genre.

The stated "North Star" objective is to achieve the depth, tactical fidelity, and emergent realism of the *Football Manager* (FM) series. Achieving this requires a fundamental philosophical and architectural paradigm shift. In an arcade-style engine, physical collision and geometric intersection are the primary drivers of success; a pass is completed if the ball's geometric trajectory intersects with a teammate's bounding box before an opponent's bounding box. In a true management simulation, physical space is an illusion layered over a complex, multidimensional database of statistical probabilities. The simulation must resolve the question of "what should the player choose to do based on their mental attributes?" and "is the player statistically capable of executing this action based on their technical attributes?" long before the visual engine calculates the physical trajectory of the ball.1 The underlying engine calculates a deterministic outcome based on tactical instructions, physical fatigue, spatial pressure, and player attributes, and the 2D SVG rendering layer merely acts as a post-hoc visualizer of that predetermined reality.3

This comprehensive report provides an exhaustive audit of the conceptual execution phases, a structural blueprint for migrating the AI architecture away from rigid state machines toward a hybrid Utility Artificial Intelligence and Behavior Tree model, and rigorous mathematical frameworks for modeling spatial pressure and tactical roles. Furthermore, it addresses the strict performance ceilings inherent to DOM-based SVG rendering within the Svelte 5 ecosystem, proposing architectural mitigations leveraging the new "Runes" reactivity model. Finally, an exhaustive, prioritized ten-step technical roadmap is provided to guide the transition from the current arcade state to a profound, relationist tactical simulation.

## **2\. Critique of Execution Phases: The Simulation Audit**

Based on the parameters of the existing codebase and the implied execution phases, the current trajectory exhibits a significant bias toward visual physics and deterministic geometric outcomes. While foundational physics—such as velocity, friction, spin, and z-axis trajectory—are necessary for convincing visual representation, elevating them to the status of core resolution mechanics fundamentally limits the depth of the simulation. If the engine continues to prioritize geometry over data-driven probability, it will fail to accurately represent the nuanced differences between a player with a passing attribute of 10 versus a passing attribute of 20, or the cascading impact of low match morale on execution fidelity.

### **2.1 The Limitations of Physics-First Resolution**

When an engine relies primarily on spatial physics to determine outcomes, it inevitably flattens player individuality. A structurally sound tactical formation will inherently succeed regardless of the personnel executing it, because the geometrical passing lanes are open. This contradicts the core appeal of a management simulation, where identifying, recruiting, and deploying players with specific psychological and technical profiles is the primary gameplay loop. In a true simulation, a perfect tactical setup can still fail if the player executing the final pass possesses a low "Decisions" attribute or buckles under the "Pressure" of the match context.4 Therefore, the execution phases must be rewritten to interpose a statistical resolution layer between the player's intention and the physical outcome.

### **2.2 Proposed Execution Phases for Deep Simulation (Phases 7, 8, and 9\)**

To realign the project with the depth of the *Football Manager* series, the following advanced phases must be integrated into the overarching strategic roadmap. These phases shift the engine from a physics toy to a cognitive and statistical simulator.

#### **Phase 7: Attribute-Driven Event Resolution and the Statistical "Roll"**

The rigid deterministic physics engine must be subordinated to a probabilistic attribute resolution layer. Before any physical action—whether a shot, a pass, a cross, or a tackle—is simulated geometrically, an underlying statistical "roll" must occur.2 This phase involves constructing the mathematical models where a player's technical attributes (e.g., Technique, Finishing, Passing) and mental attributes (e.g., Anticipation, Concentration, Vision) dictate the physical parameters applied to the ball.5 For example, if a player attempts a forty-yard diagonal pass, the engine must compare the player's Passing and Vision attributes against the distance, the weather conditions, and the Interception attributes of the defenders in the passing lane. The outcome of this probability matrix determines the degree of error injected into the ball's physical vector. A successful roll results in a perfect trajectory; a failed roll results in skewed velocity, improper spin, or a deviated angle. The visual engine then simply animates this statistically predetermined error.

#### **Phase 8: Cognitive Simulation and Contextual Modifiers**

A profound sports simulation requires the continuous tracking and application of unseen psychological and physiological variables. This phase introduces dynamic, real-time modifiers such as Match Pressure, Physical Fatigue, Mental Fatigue, Momentum, and Morale. These variables must continuously alter the base attributes of the players, creating a fluid simulation where a player's effectiveness ebbs and flows throughout the ninety minutes.6 Cognitive models, such as dual-process theory, must be integrated to simulate how players switch between intuitive, fast judgments (when highly confident or playing in a familiar system) and deliberate, panicked reasoning (when fatigued or under heavy spatial pressure).6 This phase ensures that a team leading by three goals plays with a structurally different cognitive fluidity than a team fighting against relegation in the final ten minutes of a match.

#### **Phase 9: Emergent Tactical Relationism and Topological Play**

Moving beyond rigid, grid-based formations (e.g., a static 4-4-2 or 4-3-3), this phase implements modern tactical concepts such as "Relationism" and positional play. Players must dynamically recognize spatial overloads, create third-man runs, and execute rotational coverage based on their specific tactical roles and the real-time spatial distribution of both teammates and opponents.8 This requires migrating the engine's understanding of space from absolute coordinates (e.g., "Player X must stand at coordinates 40, 60") to relative topological mapping (e.g., "Player X must maintain a triangular passing network with the nearest holding midfielder and overlapping fullback").8 This phase allows for the simulation of complex in-possession shapes, such as a 4-3-3 morphing seamlessly into a 3-2-5 or 2-3-5 during the build-up phase.8

## **3\. Artificial Intelligence Architecture: Moving Beyond State Machines**

The current implementation utilizes a simple Finite State Machine (FSM) to manage agent behavior, transitioning players between discrete states such as PRESS, SUPPORT, SHOOT, and POSITION. While FSMs provide strict, predictable flow control and are highly effective for simple arcade games, they scale extraordinarily poorly when faced with the exponential complexities of a twenty-two-agent sports simulation.11

### **3.1 The Inherent Limitations of Finite State Machines**

Finite State Machines require explicit, hardcoded transitions defined for every possible scenario an agent might encounter. As the depth of the simulation increases, the FSM inevitably suffers from a phenomenon known as "state explosion".12 For instance, determining whether a midfielder should transition from POSITION to PRESS requires evaluating the distance to the ball carrier, the player's current stamina, the tactical team instructions, the player's individual aggression attribute, the proximity of covering teammates, and the current scoreline. Hardcoding these myriad, overlapping conditions into an FSM creates rigid, predictable, and ultimately brittle artificial intelligence.11 Furthermore, FSMs fundamentally lack the capacity to handle analog concepts, such as uncertainty, nuance, or the prioritization of multiple simultaneously valid options.15 They force binary decisions in a sport defined by gray areas.

### **3.2 The Hybrid Architectural Solution: Utility AI and Behavior Trees**

To achieve the nuanced, context-sensitive depth of a management simulation, the artificial intelligence architecture must strictly separate the concept of *decision-making* from the concept of *execution*.11 This is best achieved through a hybrid architecture combining Utility AI and Behavior Trees.

#### **3.2.1 Utility AI: The Cognitive Decision Maker**

Utility AI shifts the architectural focus from "what actions are possible" to "which action has the highest absolute value in this exact millisecond".16 It acts as the cognitive brain of the player. Every possible action available to a player (e.g., Short Pass, Long Pass, Dribble, Shoot, Clear Ball, Hold Position, Press) is evaluated by a scoring function that generates a normalized utility score, typically between 0.0 and 1.0.17 These scores are generated by combining multiple consideration curves (linear, exponential, logistic) based on real-time environmental data.18

For example, the utility score for "Shoot" might be a combined product of the distance to the goal, the player's Finishing attribute, the angle of the shot, and the density of defenders in the blocking path. Utility AI allows for highly nuanced, context-sensitive decision-making where a player might weigh the utility of a high-risk, line-breaking pass against a safe, lateral retention pass, factoring in their own "Vision" attribute and the current match momentum.7

#### **3.2.2 Behavior Trees: The Physical Executor**

Once the Utility AI selects the highest-scoring action (e.g., determining that "Execute High-Risk Through Ball" has a utility score of 0.85, beating out "Dribble" at 0.60), a Behavior Tree takes over to handle the physical execution of that decision.16 Behavior Trees are hierarchical, modular structures composed of sequences, selectors, and action leaf nodes.13 They evaluate from root to leaf on every tick, returning one of three states: Success, Failure, or Running.19

Behavior trees are highly effective at managing the step-by-step physical sequences required to achieve the goal selected by the Utility AI. If the goal is "Execute Pass," the Behavior Tree manages the micro-sequence: \-\> \-\> \-\> \-\>.13 If an opponent steps into the passing lane during this sequence, the \`\` node returns "Failure," bubbling up the tree and forcing the Utility AI to immediately recalculate the next best action based on the new environmental data.19

#### **Table 1: Architectural Responsibilities in a Hybrid AI System**

| AI Architecture Component | Core Responsibility | Output Mechanism | Strengths in Sports Simulation |
| :---- | :---- | :---- | :---- |
| **Utility AI** | High-level decision making and prioritization. | Normalized scalar score (0.0 to 1.0) for every possible action. | Handles nuance, analog gray areas, and attribute-driven personality weighting beautifully. |
| **Behavior Trees** | Low-level execution, sequencing, and spatial navigation. | State returns: Success, Failure, or Running. | Highly modular, handles interruptions gracefully, excellent for complex physical sequences. |
| **Finite State Machine** | Macro match-phase management (e.g., Kickoff, Halftime, Penalty Kick). | Rigid state transitions based on explicit events. | Useful only for absolute, rules-based engine states, not for dynamic player intelligence. |

### **3.3 Implementing Decision-Making Under Pressure: The Composure Model**

The true test of a deeply simulated artificial intelligence is how agents react to adversity and spatial constriction. Implementing the "Composure" attribute requires mathematically defining "Pressure" within the engine and applying it as a dynamic modifier to the Utility AI scoring functions.

#### **3.3.1 Mathematical Definition of Spatial Pressure**

Pressure cannot be treated as a binary state; it is a continuous, dynamic variable influenced by the proximity, velocity, and approach angle of opposing players. Drawing on advanced football data analytics methodologies, the pressure (![][image1]) exerted by a single defending opponent ![][image2] on the ball carrier can be calculated using an exponential decay function 21:

![][image3]  
In this mathematical model:

* ![][image4] represents the absolute distance between the defending player and the ball carrier.  
* ![][image5] represents the maximum theoretical distance threshold from which spatial pressure can be applied. Advanced models dynamically scale ![][image5] based on the pitch zone; for example, ![][image5] is tighter in the defensive third and broader in the final third.21  
* ![][image6] is an exponential decay factor that accounts for the defender's current momentum, velocity vector, and facing angle relative to the ball carrier.

The total raw spatial pressure (![][image7]) acting upon the ball carrier is the cumulative sum of all individual defender pressures, typically capped at a theoretical maximum value to prevent overflow.21

#### **3.3.2 The Composure Dampening Algorithm**

The "Composure" attribute acts as a psychological dampening field against this raw spatial pressure.5 A player's Composure attribute (![][image8], typically on a scale of 1 to 20\) mathematically modifies the raw spatial pressure into an *Effective Pressure* (![][image9]) metric. This Effective Pressure is the value that is actually fed into the Utility AI cognitive evaluations.

![][image10]  
Where ![][image11] acts as a global engine tuning constant. Under this model, a world-class midfielder with a Composure attribute of 20 will mathematically perceive significantly less effective pressure than an inexperienced academy player with a Composure attribute of 5, even if both players are standing in the exact same spatial geometric configuration surrounded by the same three defenders.

#### **3.3.3 Algorithmic Impact on Utility Scoring**

Effective Pressure serves as a direct, dynamic modifier to the utility evaluation scores of all potential actions.24 As Effective Pressure increases, the utility curves for complex, high-risk actions (such as attempting a "Long Diagonal Pass" or a "Dribble") are severely penalized and forced downward.18 Conversely, the utility curves for simple, low-risk actions (such as a "Clearance" or a "Short Backward Pass") are amplified.18

Furthermore, the player's "Decisions" attribute dictates their ability to accurately calculate these utility scores in the first place. A player possessing a low Decisions attribute combined with high Effective Pressure will experience artificially warped and highly inaccurate utility scores, leading them to select highly suboptimal actions, such as attempting a low-probability shot from forty yards instead of executing a simple overlapping pass.4 This creates emergent, realistic mistakes driven entirely by the simulation's statistical parameters rather than arbitrary randomness.

## **4\. Tactical Fidelity: Evolving from Spatial Zones to Behavioral Roles**

The current iteration of the engine relies on a "Zone-based" formation editor, which strictly dictates where players stand on a two-dimensional grid. To achieve profound tactical realism, the engine must evolve into a "Role-based" systemic model. In real-world football, and in deep simulations, a 4-3-3 formation utilizing a 'Deep Lying Playmaker' (DLP) operates with entirely different passing networks and spatial dynamics than a 4-3-3 utilizing a 'Ball Winning Midfielder' (BWM).25

### **4.1 Deconstructing Tactical Roles and Duties**

Player roles act as a complex set of hardcoded tactical instructions, movement directives, and behavioral constraints that permanently modify the agent's baseline Utility AI calculations.26 Roles operate fundamentally on three distinct tactical axes:

1. **Positional Anchoring and Topography:** Roles dictate the spatial constraints and relative topological positioning applied to a player during different macro-phases of play (Build-up, Progression, Final Third, Defensive Transition).28 For instance, a 'Half-Back' is instructed to drop between the central defenders during the build-up phase, forcing the defensive line to expand into a back-three topography.26  
2. **Duty Alignment (Defend, Support, Attack):** This modifier dictates the verticality, aggressive positioning, and overall risk profile of the player.26 A player on an 'Attack' duty will operate higher up the pitch and prioritize penetrative utility scores, while a 'Defend' duty prioritizes holding position and lateral passing utility.  
3. **Behavioral Utility Weighting:** Roles apply specific mathematical multipliers to the player's Utility AI curves, fundamentally altering their cognitive preferences.18

### **4.2 Architectural Implementation of Behavioral Roles**

To implement these roles effectively within the Svelte/SVG engine, roles should not be written as complex IF/THEN statements. Instead, they must be defined as decoupled Data Objects that inject specific multiplier weights directly into the Utility AI evaluation functions.24

#### **Table 2: Utility Weight Modifiers by Tactical Role Archetype**

| Tactical Role & Duty | Primary Positional Anchor | Utility Multiplier: Aggressive Tackle | Utility Multiplier: Dribble | Utility Multiplier: Risky Pass | Utility Multiplier: Hold Position |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Ball Winning Midfielder (Defend)** | Fluidly tracks the ball carrier within the defensive third. | **\+45%** (Highly aggressive) | \-50% (Strictly discouraged) | \-35% (Strictly discouraged) | \-25% (Actively chases the ball) |
| **Deep Lying Playmaker (Support)** | Fixed to the central topological grid; operates behind the ball. | \-15% (Cautious) | \-25% (Discouraged) | **\+40%** (Actively encouraged) | **\+45%** (Maintains structural shape) |
| **Mezzala / Half-Winger (Attack)** | Drifts horizontally into the half-spaces and wide attacking channels.26 | \-20% (Cautious) | \+25% (Encouraged) | \+15% (Situational) | \-50% (Roams freely from center) |
| **Box-to-Box Midfielder (Support)** | Continuous vertical transitions between the two penalty boxes. | \+15% (Situational) | \+15% (Situational) | \+10% (Situational) | \-40% (Highly dynamic engine room) |
| **Enganche (Support)** | Static offensive pivot located centrally behind the strikers.26 | \-40% (Minimal defensive output) | \-30% (Relies on passing, not movement) | **\+50%** (Primary creative hub) | **\+60%** (Requires teammates to move around them) |

Data parameters synthesized from tactical logic models and utility-based AI frameworks.18

When the Utility AI evaluates the specific question, "Should I break formation to close down the attacking ball carrier?", the Ball Winning Midfielder's role object injects a heavy positive multiplier into the "Press/Tackle" utility function. Conversely, the Deep Lying Playmaker's role object severely reduces that same utility score, causing the DLP's cognitive engine to naturally prefer the "Jockey/Hold Position" action. This multiplier system ensures that players naturally express their tactical archetypes organically without requiring rigid, overriding scripts.14

Furthermore, "Player Preferred Moves" (PPMs) or innate personality traits (e.g., "Argues with Officials," "Shoots from distance," "Plays one-twos") act as a secondary, highly individualized layer of utility multipliers. These traits can override or amplify tactical instructions when specific psychological or environmental thresholds are met, adding a layer of unpredictable human element to the simulation.26

## **5\. The SVG Constraint: Navigating Performance Ceilings and Mitigations**

The commitment to utilizing a pure Svelte 5 (Runes) and Inline SVG technology stack is highly unconventional for a complex, twenty-two-agent physics and statistical simulation. Traditionally, engines of this magnitude rely on WebGL or HTML5 Canvas rendering to handle high-frequency visual updates.33 However, the declarative nature of SVG, combined with Svelte 5's profound advancements in granular reactivity, presents unique advantages for seamless DOM manipulation—provided that the inherent performance ceilings of the browser rendering pipeline are meticulously managed and mitigated.

### **5.1 Identifying the Performance Ceilings of SVG Animation**

Browsers render SVG elements as discrete, individual nodes within the Document Object Model (DOM). While modern browser engines can easily handle rendering thousands of static SVG elements, animating them continuously at a target of 60 Frames Per Second (FPS) induces severe computational bottlenecks, primarily through layout thrashing, recalculation, and repainting.35

The primary structural bottlenecks encountered in a high-frequency simulation loop include:

1. **DOM Layout Thrashing:** Continuously updating structural geometric attributes (such as cx, cy, width, height, x, or y) forces the browser engine to recalculate the layout and geometry of the entire SVG canvas on every single 16.67ms tick.36 This CPU-bound operation will rapidly degrade framerates.  
2. **Path Complexity and Morphing:** Attempting to animate the d attribute of a \<path\> element (for instance, to simulate complex limb movement or dynamic eight-directional player facing) is extraordinarily CPU-intensive. Path morphing forces continuous repaints and fundamentally bypasses hardware acceleration.36  
3. **Component State Overhead:** If the game loop triggers component-wide re-renders rather than surgical, fine-grained node updates, Svelte's reactivity model will eventually overwhelm the main JavaScript thread.37

### **5.2 Architectural Mitigations Leveraging Svelte 5 Runes**

Svelte 5's introduction of "Universal Reactivity" via the Runes paradigm ($state, $derived, $effect, $props) provides the exact architectural tooling necessary to mitigate these DOM ceilings.38 Because Runes utilize underlying signals and can exist purely within raw .svelte.ts files, the entirety of the simulation logic can be completely decoupled from the UI rendering layer.

#### **5.2.1 Complete Decoupling of Logic and Rendering**

The game engine must execute a deterministic, mathematical requestAnimationFrame (rAF) loop that updates a centralized, headless $state object representing the match data.34 The Svelte UI components should merely *subscribe* to this state, updating the DOM only during the browser's natural paint cycle.39

This architecture guarantees that the heavy mathematical calculations (Utility AI scoring, topological mapping, pressure modifiers) run entirely in raw TypeScript memory, unburdened by DOM interactions.

TypeScript

// engine.svelte.ts (Headless Logic and Simulation Layer)  
export const matchState \= $state({  
    players: Array.from({ length: 22 }, () \=\> ({ x: 0, y: 0, rotation: 0, posture: 0 })),  
    ball: { x: 0, y: 0, z: 0 },  
    clock: 0  
});

export function gameLoop(delta) {  
    // 1\. Evaluate Utility AI and Behavior Trees in memory  
    // 2\. Resolve Statistical Attribute "Rolls"  
    // 3\. Update spatial coordinates in matchState  
}

#### **5.2.2 Forcing GPU Hardware Acceleration via CSS Transforms**

To entirely bypass the devastating DOM layout bottleneck, traditional SVG positional attributes like cx and cy must be strictly abandoned.36 All player movement, ball physics, and rotational facing must be rendered utilizing CSS transform: translate() and rotate() properties. CSS Transforms are composited directly on the Graphics Processing Unit (GPU), completely bypassing the browser's heavy layout and paint phases.36

HTML

\<circle cx\={player.x} cy\={player.y} r\="5" fill\="red" /\>

\<g style\="transform: translate({player.x}px, {player.y}px) rotate({player.rotation}deg); will-change: transform;"\>  
    \<circle cx\="0" cy\="0" r\="5" fill\="red" /\>  
\</g\>

The inclusion of the will-change: transform and transform-box: fill-box CSS declarations is absolutely mandatory. This explicitly informs the browser engine to promote these specific SVG groupings to their own dedicated composite layers prior to the animation beginning, ensuring buttery smooth 60 FPS performance regardless of the underlying mathematical complexity.36

#### **5.2.3 Mitigating Limb Animation via Sprite Pooling**

To simulate complex visual animations—such as running limbs, tackling motions, or eight-directional facing—without morphing the expensive d attribute of paths, the engine must rely on SVG Sprite Pooling.36

The architecture requires pre-rendering all necessary limb states or directional facings as hidden \<g\> elements nested within the player's primary transform group. The Svelte 5 rendering layer can then highly efficiently toggle the opacity (which is also a GPU-accelerated property) or display attribute of these nested groups based on the player's current state vector.36 This technique maintains high visual complexity and feedback without sacrificing the rigid 60 FPS performance target required by the requestAnimationFrame loop.

#### **Table 3: SVG Performance Mitigation Strategies in Svelte 5**

| Animation Requirement | Prohibited Approach (CPU Bound) | Optimal Svelte 5 Approach (GPU Accelerated) |
| :---- | :---- | :---- |
| **Coordinate Movement** | Animating cx, cy, x, y attributes. | CSS transform: translate() bound to a $derived state.36 |
| **Player Rotation** | Recalculating vector geometry in TS. | CSS transform: rotate() relative to transform-box: fill-box.36 |
| **Limb/Directional Animation** | Morphing the \<path d="..."\> attribute. | Toggling opacity: 1 or 0 on pre-rendered sprite pools within the DOM.36 |
| **State Updates** | Mutating component-level variables. | Mutating a headless .svelte.ts $state object consumed by the UI.38 |

## **6\. Strategic Technical Roadmap: The Next Ten Milestones**

To successfully transition from the current arcade-leaning state to the profound depth of the "North Star" simulation goal, the following technical milestones represent a carefully prioritized, step-by-step sequence. The roadmap progresses from fundamental structural refactoring ("low-hanging fruit") to the implementation of deeply complex cognitive AI and relationist tactical systems.

### **Phase 1: Architectural Restructuring and Performance Hardening**

**Milestone 1: Decoupling the Engine via Universal Runes**

* *Objective:* Extract all match logic, physics, and AI algorithms completely out of the Svelte UI components and into headless .svelte.ts classes.  
* *Execution Details:* Implement a centralized, universally reactive $state store.38 The requestAnimationFrame loop must execute entirely within a decoupled TypeScript file, crunching the mathematical data and updating this state object. The SVG layer is relegated to a "dumb" presentation layer that simply binds to this state, ensuring surgical DOM updates and completely avoiding cascading component re-renders.39

**Milestone 2: GPU-Accelerated SVG Refactoring**

* *Objective:* Eliminate layout thrashing to secure an unbreakable 60 FPS baseline for 22 intelligent agents and the ball.  
* *Execution Details:* Audit the codebase to strip all cx, cy, x, and y dynamic bindings from the SVG markup. Replace them exclusively with CSS transform: translate(x, y) strings securely bound to Svelte $derived values. Apply the will-change: transform and transform-box CSS properties to all moving entities to force GPU layer promotion.36

### **Phase 2: Cognitive AI Foundation and Tactical Baseline**

**Milestone 3: Utility AI Infrastructure Deployment**

* *Objective:* Replace the rigid Finite State Machine (FSM) with a flexible Utility AI framework for high-level cognitive decision-making.  
* *Execution Details:* Create a modular scoring engine that continuously evaluates a dynamic array of actions (e.g., Pass, Shoot, Dribble, Press, Hold Position, Make Run).17 Implement mathematical response curves (linear, quadratic, logistic) to map raw spatial inputs—such as distance to the goal, distance to nearest passing option, and current stamina—to normalized utility scores ranging from 0.0 to 1.0.7

**Milestone 4: Behavior Tree Execution Layer**

* *Objective:* Bridge the structural gap between the Utility AI's abstract decisions and physical, geometric movement on the pitch.  
* *Execution Details:* Implement a lightweight Behavior Tree system. When the Utility AI selects "Pass to Target Player," the Behavior Tree handles the sequential execution: \-\> \-\> \-\> \[Execute Pass\].13 Implement an "inertia bucket" to heavily weight currently executing tasks, preventing the AI from dithering or oscillating between closely scored utility actions.43

**Milestone 5: Role-Based Tactical Injection**

* *Objective:* Evolve from "Zone-based" grid coordinates to "Role-based" tactical behavior and personality expression.  
* *Execution Details:* Define structured data objects for specific FM-style roles (e.g., Target Man, Anchor Man, Mezzala). Inject these structures into the Utility AI as permanent weight multipliers (e.g., an Anchor Man role object applies a 0.5x multiplier to the "Dribble" utility curve and a 1.4x multiplier to the "Hold Position" utility curve).7

### **Phase 3: Advanced Simulation Depth and Attribute Resolution**

**Milestone 6: The Spatial Pressure and Composure Psychological Model**

* *Objective:* Implement the first psychological modifier to simulate cognitive degradation and decision-making under intense stress.  
* *Execution Details:* Calculate a continuous spatial pressure value based on defender proximity, velocity, and approach angles using an exponential decay formula.21 Scale this raw spatial pressure inversely against the ball-carrier's "Composure" attribute to generate a final *Effective Pressure* score. Apply this Effective Pressure as a severe decaying modifier to the Utility AI curves for complex, high-technical actions, forcing low-composure players into hurried clearances.5

**Milestone 7: Attribute-Driven Geometric Resolution (The Statistical "Roll")**

* *Objective:* Firmly subordinate physical geometry to statistical probability, cementing the transition from arcade to simulation.  
* *Execution Details:* Immediately before a physical action is executed, perform an RNG (Random Number Generator) "roll" heavily modified by competing player attributes (e.g., the Passer's Technique and Vision versus the Defender's Anticipation and Positioning).2 Utilize the outcome of this statistical check to inject artificial, predetermined "error" into the ball's physics vector (e.g., skewing the trajectory angle by 5 degrees or reducing the velocity by 10%). The visual engine then simply animates this statistically predetermined outcome.3

**Milestone 8: Positional Play and Dynamic Topological Relationism**

* *Objective:* Allow players to dynamically adjust their shapes and form passing networks in and out of possession.  
* *Execution Details:* Implement logic for topological spatial awareness. If an overlapping Fullback pushes high into the final third, the covering Midfielder (e.g., a Carrilero role) must dynamically update their positional anchor to cover the vacated space, moving beyond strict grid-based positioning to maintain structural defensive integrity.8

### **Phase 4: Metagame Immersion and Data Analytics**

**Milestone 9: Stamina, Fatigue, and Momentum Degradation**

* *Objective:* Simulate the profound physical toll of a ninety-minute match and its cascading impact on late-game technical performance.  
* *Execution Details:* Introduce a continuous depletion of a stamina variable based on total distance covered, sprint frequency, and high-intensity pressing actions. Link the current stamina value to both physical physics (capping maximum velocity and acceleration) and the Utility AI cognitive engine (highly fatigued players begin prioritizing low-effort actions like long clearances over stamina-draining dribbles).7

**Milestone 10: Serialization, Expected Goals (xG), and Analytics Engine**

* *Objective:* Expand the existing JSON replay system into a comprehensive statistical analysis tool that proves the depth of the simulation to the end-user.  
* *Execution Details:* Record not only the geometric X/Y frames but the underlying Utility AI scores, Effective Pressure values, and attribute check outcomes for every significant match event. Establish a data pipeline capable of generating FM-style post-match analytics, passing networks, positional heatmaps, and Expected Goals (xG) probability models.7 Exposing this data validates the "North Star" goal, proving unequivocally that the engine is a deep, mathematically rigorous simulation rather than a superficial physics toy.

#### **Works cited**

1. Please explain the ME mechanics? :: Football Manager 2019, accessed on March 3, 2026, [https://steamcommunity.com/app/872790/discussions/0/1742229167198377690/](https://steamcommunity.com/app/872790/discussions/0/1742229167198377690/)  
2. How the dynamics of a sports simulation game works?, accessed on March 3, 2026, [https://stackoverflow.com/questions/1192147/how-the-dynamics-of-a-sports-simulation-game-works](https://stackoverflow.com/questions/1192147/how-the-dynamics-of-a-sports-simulation-game-works)  
3. Does anyone acyually know how the Match Engine works? 'Under, accessed on March 3, 2026, [https://community.sports-interactive.com/forums/topic/301766-does-anyone-acyually-know-how-the-match-engine-works-under-the-hood-so-to-speak/](https://community.sports-interactive.com/forums/topic/301766-does-anyone-acyually-know-how-the-match-engine-works-under-the-hood-so-to-speak/)  
4. How Important is the Decision attribute in FM? \- FM21 \- YouTube, accessed on March 3, 2026, [https://www.youtube.com/watch?v=rZGRHika9zo](https://www.youtube.com/watch?v=rZGRHika9zo)  
5. Exposing the FM Match Engine \- ONLY 9 ATTRIBUTES MATTER\!, accessed on March 3, 2026, [https://www.reddit.com/r/footballmanagergames/comments/1ameaot/exposing\_the\_fm\_match\_engine\_only\_9\_attributes/](https://www.reddit.com/r/footballmanagergames/comments/1ameaot/exposing_the_fm_match_engine_only_9_attributes/)  
6. The Psychology Behind Decision-Making in Game Design \- Haval, accessed on March 3, 2026, [https://www.havalpamosa.com.py/2025/01/12/the-psychology-behind-decision-making-in-game-design/](https://www.havalpamosa.com.py/2025/01/12/the-psychology-behind-decision-making-in-game-design/)  
7. AI-Assisted Game Management Decisions: A Fuzzy Logic Approach, accessed on March 3, 2026, [https://arxiv.org/html/2512.04480v1](https://arxiv.org/html/2512.04480v1)  
8. FM24: Positional Play, Rotations, and Relationism (Tactic Added), accessed on March 3, 2026, [https://community.sports-interactive.com/forums/topic/578533-fm24-positional-play-rotations-and-relationism-tactic-added/](https://community.sports-interactive.com/forums/topic/578533-fm24-positional-play-rotations-and-relationism-tactic-added/)  
9. Towards Quantifying Interaction Networks in a Football Match, accessed on March 3, 2026, [https://scispace.com/pdf/towards-quantifying-interaction-networks-in-a-football-match-n21zasm7i3.pdf](https://scispace.com/pdf/towards-quantifying-interaction-networks-in-a-football-match-n21zasm7i3.pdf)  
10. Best Football Manager 26 tactics: winning formations and team, accessed on March 3, 2026, [https://store.epicgames.com/hi/news/best-football-manager-26-tactics-winning-formations-and-team-systems](https://store.epicgames.com/hi/news/best-football-manager-26-tactics-winning-formations-and-team-systems)  
11. Behavior Trees vs Finite State Machines \- Opsive, accessed on March 3, 2026, [https://opsive.com/support/documentation/behavior-designer-pro/concepts/behavior-trees-vs-finite-state-machines/](https://opsive.com/support/documentation/behavior-designer-pro/concepts/behavior-trees-vs-finite-state-machines/)  
12. An Architecture for Game Behavior AI: Behavior Multi-Queues, accessed on March 3, 2026, [https://cdn.aaai.org/ojs/12350/12350-52-15878-1-2-20201228.pdf](https://cdn.aaai.org/ojs/12350/12350-52-15878-1-2-20201228.pdf)  
13. Indie AI Programming: From behaviour trees to utility AI, accessed on March 3, 2026, [https://www.gamedeveloper.com/programming/indie-ai-programming-from-behaviour-trees-to-utility-ai](https://www.gamedeveloper.com/programming/indie-ai-programming-from-behaviour-trees-to-utility-ai)  
14. Utility AI vs BT for enemies : r/gamedev \- Reddit, accessed on March 3, 2026, [https://www.reddit.com/r/gamedev/comments/196392u/utility\_ai\_vs\_bt\_for\_enemies/](https://www.reddit.com/r/gamedev/comments/196392u/utility_ai_vs_bt_for_enemies/)  
15. Building Utility Decisions into Your Existing Behavior Tree, accessed on March 3, 2026, [http://www.gameaipro.com/GameAIPro/GameAIPro\_Chapter10\_Building\_Utility\_Decisions\_into\_Your\_Existing\_Behavior\_Tree.pdf](http://www.gameaipro.com/GameAIPro/GameAIPro_Chapter10_Building_Utility_Decisions_into_Your_Existing_Behavior_Tree.pdf)  
16. Game AI Planning: GOAP, Utility, and Behavior Trees, accessed on March 3, 2026, [https://tonogameconsultants.com/game-ai-planning/](https://tonogameconsultants.com/game-ai-planning/)  
17. An introduction to Utility AI \- The Shaggy Dev, accessed on March 3, 2026, [https://shaggydev.com/2023/04/19/utility-ai/](https://shaggydev.com/2023/04/19/utility-ai/)  
18. At-a-glance functions for modelling utility-based game AI, accessed on March 3, 2026, [https://alastaira.wordpress.com/2013/01/25/at-a-glance-functions-for-modelling-utility-based-game-ai/](https://alastaira.wordpress.com/2013/01/25/at-a-glance-functions-for-modelling-utility-based-game-ai/)  
19. Behavior Trees: The Decision-Making Powerhouse Behind Modern AI, accessed on March 3, 2026, [https://www.sandgarden.com/learn/behavior-trees](https://www.sandgarden.com/learn/behavior-trees)  
20. State Machines vs Behavior Trees: designing a decision-making, accessed on March 3, 2026, [https://www.polymathrobotics.com/blog/state-machines-vs-behavior-trees](https://www.polymathrobotics.com/blog/state-machines-vs-behavior-trees)  
21. Pressure — DataBallPy Documentation, accessed on March 3, 2026, [https://databallpy.readthedocs.io/en/v0.5.0/features/pressure\_page.html](https://databallpy.readthedocs.io/en/v0.5.0/features/pressure_page.html)  
22. A Mathematical Model to Study Defensive Metrics in Football \- MDPI, accessed on March 3, 2026, [https://www.mdpi.com/2227-7390/12/23/3854](https://www.mdpi.com/2227-7390/12/23/3854)  
23. A Mathematical Model to Study Defensive Metrics in Football, accessed on March 3, 2026, [https://www.preprints.org/manuscript/202411.1787/v1/download](https://www.preprints.org/manuscript/202411.1787/v1/download)  
24. Help understanding how to combine scorers in Utility AI : r/gameai, accessed on March 3, 2026, [https://www.reddit.com/r/gameai/comments/qbuuob/help\_understanding\_how\_to\_combine\_scorers\_in/](https://www.reddit.com/r/gameai/comments/qbuuob/help_understanding_how_to_combine_scorers_in/)  
25. Playing Style Implementation | PDF | Association Football \- Scribd, accessed on March 3, 2026, [https://www.scribd.com/document/658037181/www-guidetofm-com2](https://www.scribd.com/document/658037181/www-guidetofm-com2)  
26. Understanding roles in Football Manager (and real life) (part 2\) | by ..., accessed on March 3, 2026, [https://v-maedhros.medium.com/understanding-roles-in-football-manager-and-real-life-part-2-a889e488a0f0](https://v-maedhros.medium.com/understanding-roles-in-football-manager-and-real-life-part-2-a889e488a0f0)  
27. Football Manager Tactics – Building Blocks with Roles, accessed on March 3, 2026, [https://fmrashidi.wordpress.com/football-manager-tactics-building-blocks-with-roles/](https://fmrashidi.wordpress.com/football-manager-tactics-building-blocks-with-roles/)  
28. Breaking Down Football Manager 2026's New Tactical Evolution, accessed on March 3, 2026, [https://www.footballmanagerblog.org/2025/10/fm26-new-tactical-evolution-breakdown.html](https://www.footballmanagerblog.org/2025/10/fm26-new-tactical-evolution-breakdown.html)  
29. How's my Tactic? (First ever FM save so specific roles are still new to, accessed on March 3, 2026, [https://www.reddit.com/r/footballmanagergames/comments/1i5oopg/hows\_my\_tactic\_first\_ever\_fm\_save\_so\_specific/](https://www.reddit.com/r/footballmanagergames/comments/1i5oopg/hows_my_tactic_first_ever_fm_save_so_specific/)  
30. rotexpro/Football-Manager-Project \- GitHub, accessed on March 3, 2026, [https://github.com/rotexpro/Football-Manager-Project](https://github.com/rotexpro/Football-Manager-Project)  
31. How to Play FM: A (Very) Short Guide to Understanding the Match, accessed on March 3, 2026, [https://community.sports-interactive.com/forums/topic/206765-how-to-play-fm-a-very-short-guide-to-understanding-the-match-engine-and-manager-ai/](https://community.sports-interactive.com/forums/topic/206765-how-to-play-fm-a-very-short-guide-to-understanding-the-match-engine-and-manager-ai/)  
32. MIMIC: Integrating Diverse Personality Traits for Better Game ... \- arXiv, accessed on March 3, 2026, [https://arxiv.org/html/2510.01635v1](https://arxiv.org/html/2510.01635v1)  
33. SVG game at 60fps \- Show and Tell \- Elm Discourse, accessed on March 3, 2026, [https://discourse.elm-lang.org/t/svg-game-at-60fps/1424](https://discourse.elm-lang.org/t/svg-game-at-60fps/1424)  
34. Question about Rerenders in requestAnimationFrame : r/sveltejs, accessed on March 3, 2026, [https://www.reddit.com/r/sveltejs/comments/1epo8xe/question\_about\_rerenders\_in\_requestanimationframe/](https://www.reddit.com/r/sveltejs/comments/1epo8xe/question_about_rerenders_in_requestanimationframe/)  
35. Normal performance for 2D engine? : r/gamedev \- Reddit, accessed on March 3, 2026, [https://www.reddit.com/r/gamedev/comments/u3m06y/normal\_performance\_for\_2d\_engine/](https://www.reddit.com/r/gamedev/comments/u3m06y/normal_performance_for_2d_engine/)  
36. How to Optimize SVG Animations for Smooth Performance ... \- Zigpoll, accessed on March 3, 2026, [https://www.zigpoll.com/content/how-can-i-optimize-svg-animations-to-run-smoothly-on-both-desktop-and-mobile-browsers-without-significant-performance-loss](https://www.zigpoll.com/content/how-can-i-optimize-svg-animations-to-run-smoothly-on-both-desktop-and-mobile-browsers-without-significant-performance-loss)  
37. Svelte 5 Refresher with Runes \- luminary.blog, accessed on March 3, 2026, [https://luminary.blog/techs/05-svelte5-refresher/](https://luminary.blog/techs/05-svelte5-refresher/)  
38. Introducing runes \- Svelte, accessed on March 3, 2026, [https://svelte.dev/blog/runes](https://svelte.dev/blog/runes)  
39. Runes and Global state: do's and don'ts | Mainmatter, accessed on March 3, 2026, [https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/](https://mainmatter.com/blog/2025/03/11/global-state-in-svelte-5/)  
40. Gain Motion Superpowers with requestAnimationFrame \- Medium, accessed on March 3, 2026, [https://medium.com/@bdc/gain-motion-superpowers-with-requestanimationframe-ecc6d5b0d9a4](https://medium.com/@bdc/gain-motion-superpowers-with-requestanimationframe-ecc6d5b0d9a4)  
41. Exploring the magic of runes in Svelte 5 \- LogRocket Blog, accessed on March 3, 2026, [https://blog.logrocket.com/exploring-runes-svelte-5/](https://blog.logrocket.com/exploring-runes-svelte-5/)  
42. Handling high-frequency real-time data with Runes \- DEV Community, accessed on March 3, 2026, [https://dev.to/polliog/real-world-svelte-5-handling-high-frequency-real-time-data-with-runes-3i2f](https://dev.to/polliog/real-world-svelte-5-handling-high-frequency-real-time-data-with-runes-3i2f)  
43. Utility AI / restructuring the AI system \- Thrive Development Forum, accessed on March 3, 2026, [https://forum.revolutionarygamesstudio.com/t/utility-ai-restructuring-the-ai-system/919](https://forum.revolutionarygamesstudio.com/t/utility-ai-restructuring-the-ai-system/919)  
44. 5 Advanced Model Creation with NFL Data, accessed on March 3, 2026, [https://bradcongelio.com/nfl-analytics-with-r-book/05-nfl-analytics-advanced-methods.html](https://bradcongelio.com/nfl-analytics-with-r-book/05-nfl-analytics-advanced-methods.html)  
45. LLM-as-a-simulator | Fine-tuning LLMs to simulate football matches, accessed on March 3, 2026, [https://medium.com/@cemrtkn/llm-as-a-simulator-fine-tuning-llms-to-simulate-football-matches-537c0e678b55](https://medium.com/@cemrtkn/llm-as-a-simulator-fine-tuning-llms-to-simulate-football-matches-537c0e678b55)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAYCAYAAAD3Va0xAAAA2UlEQVR4XmNgGAWkgglA/BGI/0PxdyB+hya2Cq6aCADThA7kGSDiu9AlcAGQ4uPoglCAyxIMEMEAUeiOLgEEnAwkGHSNAbfC9QwQuQB0CWwAl42ODBDxiegSuADMoA9A/B6If0D5l4FYGEkdXgALnyR0CSwgC4iL0QVh4CYDdm9hA2EMkMDHCnCFD8kAZMgddEEs4CkQf0EXhIFqBohB6egSaOAclMZw+WQg/swAiSFQvvoKxP9QVGACTyC+ji5IDgAlCRl0QXIAzFt1KKJkgNdA/ABdcBTgBwDtvTuYIAzPqwAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAXCAYAAADHhFVIAAAAaElEQVR4XmNgGHigAMT30QVh4C0Q/0cXpAx0AnECuiAI/IDSIPsckSVmAjETlA2SdEWSY6iF0v0MeFwKkihEFwSBPAaELmEgNkGSA0u8g7IfI0uAwDMgPsQAsT8TTQ4MAoBYDF1w6AAA4oAS3/pLqloAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAYCAYAAADzoH0MAAAA2UlEQVR4XmNgGBFAAohl0AWJAQuB+D8UF6HJEQ00GSAGsKBLEAtWMkAMIBuANH9FFyQEeoC4CcoGGVCDJIcXVALxLyhblQERgOxwFXhAKgNEMQeS2CWoGFEApPA5FrHvaGIgcBKI+ZAFPBggitORBaFiDWhiINCKLrCMAdOpKlAxZC/hBFMYMA1YgiS2FErLA/E+IJ4L5cMBNwOqAcFQPkwMRt8GYiEg/gvlowBnBoSmbKjYPygfpAkGQAEYgcQnGaB7lSTgwADxBi8QC6BKEQ9+APFydMGRDgBhbjHxDDeR+wAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAYCAYAAAAh8HdUAAAAjklEQVR4XmNgGP5gHhB/AuL/SPgjEPchK8IFYBqIBowMEA1n0SXwgWwGiCYvdAl84CUDiU4DAZL9AwIgDSfQBfEBQv5xQhcAgdcM+J0GijMMgM8/NUDsiC7IzADRcBFdAghkGXAY1s8AkQhEE58BFb+ALLgYiH8B8V8g/gdVAMMg/h8g/g7EMjANo4DuAAC9SCmctvS58wAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAZCAYAAADjRwSLAAAAlElEQVR4XmNgGAU0A5eA+AUQ/wNiNyB+CMSGyAr+A3EdGh+E4eAjugAQPEMXA3GeIwtAxb7BOCFQgXS4NASAxGphnB1QAWSgAhVjhwlMgQoggyXoYtxoAsFQ/g8kMTBwhkqAsA+UbkBWgA7UGCCKONElkMF6Bkw3woE4EBczIKzNRJWGAEkgdgdiJyB2AeIAVGm6AQAwrybsyxK/hQAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAYCAYAAABnRtT+AAABeklEQVR4Xu2WzStFURTF98DEgAFlKkNT8gcwwIwyUSgpyezN/RPEnLGJuWRIJiQiHyWZST6SiHys3TnH2285px5P797B/dXqnb3Xevfu+/HufSIFBflmHnqAPr2eoVvqrX6nMyYMxLSL66+zkQU6yDY3PakDqCuj4oYYYAM0Sk6GPJL0EGvivGE26k3qTPWK6y+wkQVhyHvoDnrx9QHUanKZEe7HKTbqRAe0B52wYVEzdqljVJtTfpPdgSa4aUndjzGqzSn/mtXAOTeJcCCxA7qCVsS9qZRUthO6FPckmYUajMfbrGBOXGCGjQi70BD17ManoS2/5mwL9G5q+71BSZykRehR3C9Z39NP0EdF4id8tPvQkqlL0LVfc1b3NW5q6+tbbszUNcE71rrZ1DqIns3gWWw9CW2YmrN/pg869usL//kGtfl1k5QvZyxrB9F/V/1SzgRvxH/WxKu451lAb3ztbULLpq9wtgu6gU6hHugM6vbeoe8XFOSaL8Upc2Lba9TDAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAYCAYAAAAlBadpAAAAsUlEQVR4XmNgGJZAGogLgHgmECshiVshsTHAYiD+D8S3gdgbiFWBeBoQPwdiS6gcVgCS+AfE/OgSQFDJAJG/hC4BAn8Y8JgKBSD5IHTBD1AJTnQJNIBhuC5U8Ba6BBaAofkvVBCbPwkCkEYME4kFZGtmZoBofIkugQVgtYAYmy2AOAFdEATuMkA0g1yBDYDEX6ELIgOQZlAiQTfACIhfo4lhBbsZEF74CqVTUVSMgqEIAG1gK0HBSgf2AAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAYCAYAAACfpi8JAAABgUlEQVR4Xu2VzysFURTHvxLykpINK8pKiljZyYqlUrK2sZGylo1/AMlfYGdjoRQpsmBlpZTyB7yNX0mscM47d54733l3Ysy8LN6nvr0333Pm3nvu3M4FGjT4HZuiZ9Gn05vogby9anYdiCZl+mD+MQeKQie7ZNMRWmTuzMMmmuKA0I46LuQG4Yn2YbEZDhRBqOJJmL/FgaKIFvIkehS9u+drUbeX9xM62PBIi1XPxwIHMrAmmkByd5tEZViRwcJukXwxKzpOi2ic/B3RimiZ/Bih85GF0Djqd7HJaNIdmwHORUewLfa5wndBqlbnd5J/6vwEq7CERQ7UQPPa3H/tNyUvpmyItsmLCO1U5YUXWGV6r7yKPmIZcZZgg53A7qLpeLiCjjXGpjACu7dy4VC0yyYRqlp7kO5WLuinO/CeR0X93rMSWojuxiCbf+FMdAH7BL3xEHpgzbAWoQXmzqxoXTRH/rD7TTt7uaGN6x52gBndCe3aAxwoiiE2HM1Iaef/ii+R316Z4MwZYwAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,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>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAXCAYAAADduLXGAAAAoElEQVR4XmNgGJSAEYhV0QWxgadA/B+KiQJXGEhQDFJ4DV0QFwApjkAXxAaiGDCd0ATE/mhiYHCTAaGYC4jvAzEfEH+Dq0ACIIW3gVgQiDdCxX5CxTEASHAnEM9El0AHMxgQJsyGslUQ0qgAPTJA7INQdj6SOBiAJKeh8VuQ2HDACRUQRRL7CMQbgLgHiA2RxMHAE10ACDyAmANdcBTAAACQdCSKrBERiwAAAABJRU5ErkJggg==>