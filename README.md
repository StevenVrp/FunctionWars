# Function Wars

Construct. Analyze. Attack. Adapt.

Function Wars is a mathematical artillery game for the browser. Build a weapon by writing a real function, adjust its coefficients, then fire along its graph.

## Play

The release ZIP contains `PLAY.html`, a self-contained browser edition with embedded fonts, artwork, code, and the equation evaluator. Extract the ZIP before opening it. The `dist/` directory is the static hosting edition.

To run the source, use a recent Node.js 22 LTS or Node.js 24 with npm.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. Offline modes need no account. The online room function and database schema are installed on the configured Supabase project. See [ONLINE_SETUP.md](ONLINE_SETUP.md) for two-account play and deployment details.

| Mode             | Play                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duel Arena       | Both pilots share a real-time clock. Choose local or online play, six battlefield layouts, a refill interval, and forbidden tiers or weapon designs.                                        |
| Puzzle Campaign  | Choose one of fifty missions. The orange ring marks the target. A mint vertical marker marks a required intermediate gate. Each mission has a hint, par score, shot budget, and precision challenge. |
| Function Sandbox | Type or select a function, edit named or literal coefficients, adjust slider bounds, pin up to three comparison curves, and fire. Save a named design to use in another mode.                      |

**First shot.** Open the sandbox and load the Parabola template. Its expression is `a*u*(1-u/20)`. At `u = 20`, it returns to launch height. Increasing `a` lifts the arc over an obstacle while preserving that second root. Try a duel on the Rift map and change the coefficient until the arc clears the central pillar.

### Controls and progression

- Use Tab to move between controls, arrow keys on sliders, and Enter or Space to activate buttons. Numeric fields accept precise coefficient values.
- Drag the sandbox graph or focus it and press the arrow keys to pan. Use the zoom buttons and Reset view to restore the original axes. Pointer coordinates appear below the plot.
- Both pilots can aim and fire independently. For same-keyboard play use Shift+1 and Shift+2 to fire the corresponding pilot's prepared equation. Each pilot may have one shot in flight. A move costs 2 energy. Moving and dropping cover can alter the remaining path of a shot already in flight.
- Both start at 100 HP and 10 energy. Every 5, 8, 10, 15, or 20 seconds (host choice) energy resets to 10. At three minutes the higher HP wins; an exact tie draws. Simultaneous lethal hits also draw.
- Choose an orbital rift, glacial shelf, volcanic caldera, forest canopy, orbital shipyard, or flat open range. Tier IV bursts destroy the obstacle they hit. Ground slopes are permanent. Forbidden presets are checked by canonical expression, including direct entry.
- In **Equipment**, tap the placement map or use the slider to pick a barrier center in half-unit steps. Install costs 3 energy. Each pilot can have three barriers within a deployment range of 9 units at placement time. Leave 1.5 units around both tanks and avoid overlapping cover. Barriers can intercept shots already in flight.
- Terraform (6) switches maps and clears installed barriers. Overcharge (2) adds 8 damage if your next shot hits. Nuclear strike (9) deals 16 Tier IV damage and clears cover within 3 units of the enemy. A Tier IV ban disables the strike.
- Capacitor (2) carries up to 5 spare energy into the next refill. Sentry tank (4) fires a level Tier I shot for 12 damage at the next refill. Cover, terrain, and Ward I can stop it. A Tier I ban disables the sentry. Wards I through IV cost 2, 2, 3, and 3 energy and absorb one matching hit. A new ward replaces the old ward.
- A mission awards one star for completion, two within par, and three within par with a closest-center distance of at most 0.25 units. All missions can be selected immediately.
- Settings control volume, mute, animation speed, reduced motion, and the plot grid. Sound effects are synthesized with Web Audio. The field manual is accessible from the title screen and footer.
- The weapon library supports rename, delete, import, export, and opening a design in the sandbox. Saved weapons and best mission stars persist in this browser. Storage is specific to the browser and origin.

## Tank garage

Each pilot selects a chassis before the match. The host and guest make independent choices online. Multipliers apply to main-gun damage and reload duration. Shared powers and the green sentry use their listed damage values.

| Tank | Shot damage | Reload time | Exclusive equipment |
| --- | --- | --- | --- |
| Vector · cyan recon | 85% | 70% | Rapid cycle clears weapon cooldowns for 5 energy. |
| Bastion · amber siege | 125% | 130% | Breach charge lets the next shot of any tier destroy a barrier for 3 energy. |
| Warden · violet support | 100% | 100% | Field repair restores up to 12 HP for 4 energy, once per refill. |

Use **Targeting** to edit the equation and **Equipment** to buy a power. Drive and fire controls remain accessible on both panels. The sentry rolls into position behind its pilot and fires its green tracer at the energy refill. Older match states use Warden's neutral modifiers.

## Mathematics

Use `u` or the alias `x`, explicit `*` for multiplication, `^` for powers, parentheses, `pi`, and `e`. Supported functions include `abs`, `sqrt`, `sin`, `cos`, `tan`, `exp`, `ln`, `log`, and `log10`. Trigonometric arguments are in radians. Both `ln` and `log` mean the natural logarithm. Single-letter coefficients such as a, b, and c default to 1 and can range from −24 through 24. Exponent literals remain structural.

Math.js parses the input. The game converts only approved node types into its own small arithmetic tree. Evaluation recursively interprets that tree. Assignments, accessors, arrays, arbitrary calls, and implicit multiplication are rejected. Direct edits and sliders share the same tree. Literal sliders address nodes by identity and reprint the tree with precedence-preserving parentheses.

The arena is 24 × 14 world units. At distance `u`, the projectile is at `(x₀ + direction × u, y₀ + g(u) − g(0))`. Horizontal speed is 12 units per second. The renderer samples that exact function for display. Flight outcomes come from the mathematical engine before animation begins.

### Safety and complexity limits

- Domain validation runs on the original expression over the full standard weapon interval from 0 to 24, before cancelling factors or removing zero terms. A weapon keeps the same classification between modes. Interval subdivision checks denominator zeros, root and log domains, tangent poles, real powers, and bounded finite output.
- Limits include 450 input characters, 80 tree nodes, depth 8, 8 active additive terms, 12 adjustable parameters, polynomial degree 6, maximum absolute enclosing range of 10¹², and a per-trigonometric-node phase budget of 32 cycles. Domain validation has a 16,000-interval budget and maximum subdivision depth of 16.
- Normalization includes constant folding, zero elimination, combining signed like terms, polynomial coefficient collection for scoring, selected cancellations, and matched sine-square/cosine-square identities.
- Complexity uses the strongest base family, up to four points for additional active families, and three for a meaningful nested composition, capped at 12. For example, `2*sin(u)+0.1*u^2` scores 8. `sin(0.2*u^2)+ln(u+1)` scores 11.
- Activity is measured on a deterministic grid of 128 horizontal steps. An added term needs 0.25 units of launch-relative variation to contribute. Near-affine shots that deviate less than 0.25 units from their endpoint line on the grid receive the basic classification. Internal polynomial arguments of composition do not automatically count as separate outer families. These scoring rules are a bounded approximation to mathematical equivalence.

| Tier | Score | Base damage | Energy | Cooldown in refill intervals |
| ---- | ----- | ----------- | ------ | ---------------------- |
| I    | 1–2   | 14          | 2      | 0                      |
| II   | 3–5   | 24          | 3      | 1                      |
| III  | 6–8   | 34          | 4      | 1                      |
| IV   | 9–12  | 48          | 6      | 2                      |

Tier cooldowns are measured from launch in multiples of the selected refill interval. Basic weapons have a minimum launcher recovery of half a second. On a target hit, minimum separation along the hypothetical continuation through the target determines the multiplier. At distances up to 0.25, 0.45, and 0.67 units the multipliers are 1.5, 1, and 0.5, respectively. Damage rounds half up. Visible flight stops at first contact.

### Collision algorithm

Adaptive branch-and-bound searches increasing horizontal distance. Each candidate span has an x interval and an enclosing y interval from the expression tree. A span is discarded if its bounding box cannot touch the expanded circle, rounded rectangular obstacle, ground, or arena boundary. Remaining spans are subdivided to find first contact. Center-distance minimization in the target window uses the same interval bounds. Ties favor solid terrain. World-distance contact tolerance is 10⁻⁷ units, terminal horizontal subdivisions are below 10⁻⁹ units for contact and 10⁻⁸ units for closest approach. A shared 150,000-step budget produces a recoverable error on overly expensive shots.

## Project structure

| Path                | Responsibility                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/math/`         | Math.js AST allowlist, parameter binding, evaluation, normalization, interval bounds, complexity, tier tables, and the cancellable equation worker |
| `src/combat/`       | World-space collision, balance rules, serializable match and mission state, pure command reducers, movement, cooldowns, and outcome resolution     |
| `src/data/`         | Fifty structured missions with reference solutions, scoring rules, versioned browser storage, and weapon-import validation                           |
| `src/ui/`           | React screens, accessible controls, SVG battlefield, shared animation timing, settings, and synthesized audio                                      |
| `public/art/`       | Original ringed-planet landscapes, rover sprites, and game mark                                                                                    |
| `tests/unit/`       | Vitest mathematical, collision, combat, mission, and storage regressions                                                                           |
| `tests/browser/`    | Playwright end-to-end suite and browser layout/accessibility audit                                                                                 |
| `scripts/`          | Standalone HTML packaging and fixed-workload engine benchmark                                                                                      |
| `docs/screenshots/` | Screenshots taken inside the running game                                                                                                          |

State transitions take explicit actor commands, clock increments, and shot resolution events. They do not read browser time or randomness. Match IDs are supplied by the caller. A serialized state plus the same command sequence reproduces the result. The UI keeps text drafts separate from the last validated weapon.

## Build, test, and host

```sh
npm run check
npm test
npm run build
npm run benchmark
npx playwright install chromium
npm run test:browser
```

The Playwright suite loads the real contents of `dist/` under a nested origin, plays a duel to completion, solves a mission, exercises invalid input and the sliders, saves and reloads a weapon, audits accessibility, checks mobile overflow, and exercises the standalone file. Set `CHROMIUM_PATH` to use an installed Chromium executable, `FW_BASE_URL` to test a running hosted copy, or `FW_SCREENSHOTS` to choose a screenshot directory. In development, open `/tests/browser/layout.html` after building to run the responsive accessibility audit against the production assets.

For a static host, upload the **contents** of `dist/`, preserving `assets/` and `art/` beside `index.html`. A build-based deployment uses `npm ci && npm run build` and publishes `dist`. The Vite base is relative and navigation uses URL hashes, so the game works at a domain root or in a folder such as `/function-wars/` on an existing site.

### Verification and limitations

- All 50 reference shots clear their gates and targets under the actual engine. Combat tests cover simultaneous fire, tied lethal impacts, moving terrain, energy banking, sentries, wards, forbidden weapons, Tier IV obstacle destruction, and an airborne shot intercepted by a newly placed barrier.
- The Supabase integration test runs the supplied schema on a local PostgreSQL WASM engine, exercises row and column permissions, and runs the bundled Edge handler with an Auth/PostgREST transport fixture. It covers concurrent commands from two pilots, reconnect reads, command retries, and one-time ranking updates. The live schema, ranking view, project key and active Edge Function were verified. The authenticated two-player integration test used the local transport fixture.
- Activity scoring and interval checks use bounded floating-point arithmetic. Some valid expressions near singularities are rejected conservatively. The standalone build validates directly in the page and the hosted build prefers a worker.
- Screenshots from the original edition are retained where applicable. Local play supports two people on one screen; online play supports two authenticated people in an invite room. See ONLINE_SETUP.md for behavior during disconnects and ranking rules.

Third-party licenses for bundled runtime packages and fonts are in `public/licenses/`.
