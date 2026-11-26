# Architecture

## Overall

The current architecture of the web application is a SPA with stateless API calls.
* All game rules are pure TypeScript with no React imports. They live in `src/game/`, and ESLint fails if a file there imports React or UI code (`no-restricted-imports` in `eslint.config.js`).
* React is only a rendering and wiring layer.

```text
┌───────────────────────── Browser (Vite :5174) ─────────────────────────┐
│ main.tsx → <GameProvider> (useState<GameState|null>) → RouterProvider  │
│                                                                        │
│ pages/       Start Shop Battle Result HallOfFame (Layout, RequireRoute)│
│ components/  RunHeader FightBar RulesPanel BattleView RunOver          │
│              ShopArea → Shop, Backpack, HeroCard, ItemCard             │
│ src/game/: pure rules, no React ───────────────────────────────────────│
│ game.ts    phase transitions, shopLock + updateRun guard, routeForGame │
│ run.ts     economy + backpack: buy, sell, reroll, move, outcome        │
│ shop.ts    mulberry32 PRNG, rollShop, grid size                        │
│ battle.ts  buildFighter, simulateBattle (ticks, poison, heal)          │
│ build.ts   summarizeBuild (numbers on the hero card)                   │
│ items.ts   CATALOG, getItem   sets.ts   SETS, set bonuses, setProgress │
│ types.ts   all shared types                                            │
│ next to it in src/ ────────────────────────────────────────────────────│
│ rules.ts   tooltip and rule texts                                      │
│ api.ts     fetchOpponent(round), fetchHallOfFame, submitRun(run)       │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ /api (Vite proxy → :4200)
                      ┌─────────▼──────────┐
                      │ Express server     │  GET  /api/health
                      │ server/index.js    │  GET  /api/opponents?round=
                      │ opponents.js table │  GET  /api/hall-of-fame
                      │ hallOfFame.js      │  POST /api/hall-of-fame (JSON file)
                      └────────────────────┘  latency/fail params on opponents
```

## Folder layout

```text
src/
  game/        pure rules and their tests: types, items, sets, shop, run, battle, build, game, save
  components/  presentational React parts
  pages/       one component per screen
  state/       GameProvider, useGame, RequireRoute
  rules.ts     rule and tooltip texts built from the game constants
  api.ts       the HTTP requests (opponent, hall of fame)
server/
  index.js       Express routes; reads and writes the hall of fame file
  hall-of-fame.json  B7: the stored runs (written by the API, git-ignored)
  opponents.js   opponent table per round
  hallOfFame.js  B7: validate, rank and store runs (plain functions, tested)
```

Dependencies only point one way: `components`, `pages` and `state` import from `game/`, and `game/` imports nothing from them. Tests sit next to the code they test. Unless a path is given, file names in the rest of this document are inside `src/game/`.

## Game state machine

```text
 (no game) ──startNewRun──▶ shop ──startSearch(id)──▶ searching ──startBattle(id)──▶ battle
                             ▲  ▲                         │                              │
                             │  └── searchFailed(id) ◀────┘ (message shown, retry)       ▼
                             └──────────── leaveBattle ◀── replay done ──▶ finished (victory / defeat)
```

## Backpack and shop: where the logic lives

The backpack is a fixed array of 6 slots (`Backpack = (ItemInstance | null)[]`, 2 columns × 3 rows). Everything the player can do with it is split into four layers, so each layer has one job:

| Layer | File | Responsibility |
|---|---|---|
| Data | `types.ts`, `shop.ts` | The `Backpack` / `RunState` types, the grid size constants, `itemIdsOf`. |
| Rules (pure) | `run.ts` | `buyItem`, `sellItem`, `rerollShop`, `moveItem` and a matching `…Blocker` function for each. No React, no phase knowledge. |
| Guard (pure) | `game.ts` | `shopLock` says whether shopping is open in the current phase. `updateRun` refuses every shop or backpack action while it is locked. |
| UI | `components/ShopArea.tsx`, `Shop.tsx`, `Backpack.tsx`, `HeroCard.tsx` | Draw the state, read the blockers to disable buttons and show the reason, call the actions. |

One user action travels like this:

```text
click ─▶ ShopArea handler ─▶ update(game => updateRun(game, run => moveItem(run, from, to)))
                                              │
                      shopLock(game) !== null │ ──▶ return the same game (refused)
                                              ▼
                       run.ts: moveBlocker(...) !== null ──▶ return the same run (refused)
                                              │
                                              ▼
                              new run state ──▶ React re-renders
```

### Rules shared by B1 and B2

1. **Pure state → state functions.** Every action takes a `RunState` and returns a new one. Nothing is mutated.
2. **A blocker for every action.** `buyBlocker`, `sellBlocker`, `rerollBlocker`, `moveBlocker` return the reason an action is not possible, or `null`. The action calls its own blocker first, and the UI calls the same blocker to disable the button and show the reason. The UI and the rule cannot disagree.
3. **Atomic: complete or change nothing.** A refused action returns the very same object it received (`toBe(run)` in the tests). There is no half-applied state.
4. **Two kinds of guarding, kept apart.** `run.ts` guards what is about the run itself (gold, free slots, valid indices). `game.ts` guards what is about the phase (searching, replaying, run over). `RunState` has no phase, so the phase check cannot live in `run.ts`.

## B1: Shop economy

| Requirement | Implementation |
|---|---|
| Sell for half the price, rounded down | `sellPrice` = `Math.floor(price / 2)`; `sellItem` empties the slot and adds the gold. |
| Reroll for 1 🪙 | `rerollShop` costs `REROLL_COST` and draws 4 new offers from the stored seed (the next seed is stored again, so rerolls are deterministic). |
| Gold never negative | `buyBlocker` / `rerollBlocker` return "Not enough gold" before anything is paid. |
| A paid item always ends up in the backpack | `buyBlocker` returns "Backpack full" when there is no free slot. (The starter wrote to slot -1 and lost the item.) |
| No item lost or duplicated | Items keep their `uid`; `nextUid` only grows; a sold item is removed, never copied. |
| Complete or change nothing | Rule 3 above. |
| UI says why before I try | Buttons are disabled and show the reason as label and tooltip (`Shop.tsx`, `Backpack.tsx`). |
| Only while shopping | `shopLock` + `updateRun` (below). |

### When is shopping open?

`shopLock(game)` returns `null` when shopping is open, otherwise the reason:

| Phase | Condition | Shopping |
|---|---|---|
| `shop` | round 1 | open |
| `shop` | round 2 or later | closed: "Shop closed for this round" |
| `searching` | | closed: "Searching for an opponent" |
| `battle` | replay still running | closed: "Battle in progress" |
| `battle` | replay done, run goes on | **open** (the post-battle shop) |
| `battle` | replay done, run over | closed: "The run is over" |
| `finished` | | closed: "The run is over" |

So there are two shopping windows: the shop page before the very first battle, and the battle page right after a replay ends (the next round's shop and gold are already in the run at that point). Pressing "On to round X" locks the build in; the shop page of round 2 and later only shows the read-only inventory and the hero card (`shopPageOffersShop`).

### Screens

* `ShopArea` is the shop on the left and the inventory on the right, wired to `updateRun`. It is used by the shop page and by the post-battle shop on the battle page.
* `BattleView` takes the shop as an optional `shop` prop. When the replay ends it shows the shop with a compact result box beside its title and scrolls to it, so the result no longer hides the shop.
* `HeroCard` shows the hero and the build summary. The numbers come from the pure `summarizeBuild` in `build.ts` (damage and block per second from each item's cooldown).

### Decisions and trade-offs

* **Post-battle shopping counts as shopping.** Round N's shop opens right after round N-1 ends, so it is available there. The cost is that the "shop" phase alone is not the only place where `updateRun` allows actions.
* **Reroll replaces all four offers**, including ones already bought. A sold item does not return to the shop.
* **B6 closed this point:** a reroll consumes the stored seed, so the whole run, including the seed, is saved together with the gold. A refresh therefore gives no free reroll.

## B2: Backpack arrangement

| Requirement | Implementation |
|---|---|
| Select an item and see it is selected | Click an item: gold ring, "Selected" label, `aria-pressed`, and a line under the heading. |
| Move it to another slot | `moveItem(run, from, to)` in `run.ts`. |
| Occupied target swaps the two items | `moveItem` swaps the two slots; the `uid`s are untouched. |
| The interface shows which moves are possible | While something is selected, every other slot is outlined and labelled "Move here" (empty) or "⇄ Swap" (occupied). |
| Cancel a selection | Click the selected item again, or press the "Cancel" button. |

### Design

* **Rule in `run.ts`.** `moveBlocker` returns "Nothing to move", "Already there" or "No such slot"; `moveItem` swaps `backpack[from]` and `backpack[to]` (this also handles an empty target) and returns the same state if blocked. It changes only the backpack: gold, shop and `uid`s stay as they were.
* **Same guard as B1.** The move goes through `updateRun`, so arranging is open and closed exactly like buying and selling. When it is closed, the slots are disabled and the line under the heading says why.
* **Selection is UI state, not game state.** `selectedUid` is a `useState` inside `Backpack.tsx`. It is not in `RunState` or `GameState`, so it does not need to be saved (B6) or validated.
* **Selected by `uid`, not by index.** The selected index is derived on every render with `findIndex`. If the item is sold or the shop locks, the selection simply stops matching and is ignored.
* **Click logic** (`handleSlot`): nothing selected → select the clicked item; clicked the selected item → cancel; otherwise → `onMove(selectedIndex, index)` and clear the selection.
* **Props instead of imports.** `Backpack` receives `onSell` and `onMove` as optional props. Without `onMove` items cannot be selected, which is how the read-only inventory on the later-round shop page works.

### Decisions and trade-offs

* **Click to select** instead of drag and drop: it matches the requirement, works with keyboard and touch, and needs far less code.
* **Position has no effect on a battle** (README rule), so arranging is only a convenience. Only the order of lines in the combat log changes. B3 resolves effects in fixed phases, so this stays true.
* **Left out on purpose** to keep it small: Esc to cancel, drag and drop, a separate click-logic module (the click handling is about ten lines in the component).
* A refresh cancels a selection, because it is not saved.

## B3: Status effects (poison and heal)

Both effects are two more fields on the item (`ItemEffects`), resolved by the same battle loop that already handles damage and block. There is no separate status system.

| Requirement | Implementation |
|---|---|
| Poison adds stacks to the enemy | An item with `poison: N` adds one application of N stacks to the enemy when it fires. |
| A poisoned fighter regularly loses HP per stack | At the end of **every tick** each poisoned fighter loses `stacks × 1` HP (`burnPoison` in `battle.ts`). |
| Poison stacks up and ignores block | Active stacks of all applications are added together; `burnPoison` never touches block. |
| Heal restores own HP, never above max | `healItem` heals `min(heal, maxHp - hp)`. |
| At least 3 items per effect | `items.ts`: Venom Dart, Toxic Flask, Spider Fang (poison); Herbal Salve, Golden Apple, Life Charm (heal). The shop rolls from the whole catalog, so they appear automatically. |
| Opponents may use them | `server/opponents.js`: rounds 2 to 7 carry a poison or heal item. |
| Shown in battle, log, rules and tooltips | `☠️ Poison: N` line per fighter, green log lines, `EFFECT_HELP` / `STATUS_HELP` tooltips and two lines in the rules panel. |

### How a tick works now

```text
1. charge items, collect the ones that fire
2. fired items deal damage, add block and add poison   (player first, then opponent)
3. fired items heal their owner                         (after all damage of the tick)
4. poison burns: HP -= stacks, every application ages by one tick
5. knockout check (both down: the hero loses)
```

### Design

* **Poison is a list of applications** `{ stacks, ticksLeft }` per fighter (`FighterState.poison`). The number shown in the UI is the sum of the stacks that are still active, so "stacks up" is literally a sum.
* **Duration is rolled, but deterministic.** Every application lasts 2 to 4 ticks (`POISON_MIN_TICKS`, `POISON_MAX_TICKS`). `rollPoisonTicks(tick, side)` seeds the existing `mulberry32` with the tick and the side, so the same battle always rolls the same numbers and nothing else has to be passed in or saved.
* **Fixed phases make the order of items irrelevant.** Inside one side an item only changes its owner (block, heal) or the enemy (damage, poison), and the roll does not depend on the item's position. So arranging the backpack (B2) cannot change a battle, only the order of lines in the log. A test checks this.
* **Heal comes after damage** so that both sides are treated the same: a fighter at 4 HP who takes 5 and heals 3 in one tick ends at 2 HP and is not knocked out.
* **Values are constants** in `battle.ts` and are used to build the rules text, so the explanation in the interface cannot drift from the numbers.

### Decisions and trade-offs

* **New items instead of changing the old ones.** Easier to explain and the old items keep their README values. The shop now rolls from 12 items instead of 6.
* **Poison burns every tick** and the duration is what varies. This is simple to show (one counter) and Burn (B4) can differ from it by decaying and by respecting block.
* **Left out on purpose:** poison cleanse, a per-stack timer in the UI, and poison in the hero card's damage per second (it only counts direct damage).

## B4: Item sets and Burn

Sets are applied when a fighter is built, so the battle never needs to know about them. Burn is one more status next to poison.

| Requirement | Implementation |
|---|---|
| At least 2 sets, at least 3 items each, one is Fire | `items.ts` gives each item an optional `set`. **Fire**: Ember Dagger, Cinder Bow, Magma Cleaver (new). **Guard**: Oak Buckler, Pot Lid, Spiked Shield (existing items reused). |
| Bonus while 2 or more items of a set are in the backpack | `sets.ts`: `SET_MIN_ITEMS = 2`, `setProgress` counts the items per set (duplicates count). |
| Bonuses apply to player and opponents alike | `buildFighter` calls `applySetBonuses`, and both the hero and the opponent are built with it. |
| Set badges in the shop and in battle | `SetBadge` on item cards, backpack slots and in the battle view (a small set icon on each item and the active sets per fighter). |
| Active bonuses are visible | Hero card "Set bonuses" (progress `1 / 2` or `Active: …`), active set badges in battle, rules panel section "Item sets". |
| Fire adds Burn | The Fire bonus is `{ burn: 1 }`: every Fire item also adds 1 burn stack to the enemy when it fires. |

### Burn compared with poison

| | Poison (B3) | Burn (B4) |
|---|---|---|
| Comes from | items with `poison` | the Fire set bonus (`burn` effect) |
| Damage per stack and tick | 1 | **3** (`BURN_DAMAGE_PER_STACK`) |
| Block | ignored | **absorbs it first** (same `hit()` as normal damage) |
| How it ends | each application expires after a rolled 2 to 4 ticks | **one counter that loses 1 stack per tick** (`BURN_DECAY_PER_TICK`) |

### How a tick works now

```text
1. charge items, collect the ones that fire
2. fired items deal damage, add block, poison and burn  (player first, then opponent)
3. fired items heal their owner                          (after all damage of the tick)
4. poison hurts (ignores block), applications age
5. burn hurts (block absorbs it first), then decays by 1 stack
6. knockout check (both down: the hero loses)
```

### Design

* **A set bonus is just extra item effects.** `applySetBonuses(items, activeSets)` adds the bonus numbers to the effects of every item that belongs to an active set and returns new items. The catalog is never changed, and `simulateBattle` only sees ordinary items with a `burn` effect.
* **The bonus is decided before the battle.** `buildFighter` stores the result in `Fighter.activeSets` for the interface. Position in the backpack still has no effect.
* **Burn is one counter**, not a list like poison. It needs no roll, so it is easy to explain: stacks come in, hurt, and lose 1 stack every tick.
* **One damage path.** The block-first logic moved into a small `hit()` helper that item damage and burn both use, so burn "does not ignore block" by construction.
* **Values are constants** (`BURN_DAMAGE_PER_STACK`, `BURN_DECAY_PER_TICK`, `SET_MIN_ITEMS`) and build the rules text and tooltips.

### Decisions and trade-offs

* **Bonus when building the fighter** instead of inside the battle loop: opponents get bonuses automatically and the battle code stays small.
* **Fire as 3 new items, Guard from existing ones**: shows both options the requirement allows. Fire items are a little weaker on their own, because the bonus makes up for it.
* **Balance was checked with a quick simulation.** At 2 damage per stack a Fire build did about the same total damage as plain items of the same price (212 against 204 in 60 ticks), so there was no reason to pick the set. At 3 it does about 25% more (257 against 204), which rewards the set without making fights too short. Fire builds still do not beat the later opponents on their own. Rounds 3 and 5 got Fire opponents. Opponents that already carried two Guard items now get the Guard bonus too.
* **Left out on purpose:** more than one set per item, a bonus that scales with 3 or 4 items, and burn in the hero card's damage per second.

## B5: Resilient matchmaking

One small piece of state, a search id, and one rule: only the answer to the search that is running right now may change the game. The guards are pure functions in `game.ts`, in the same style as the B1 blockers. Before B5, a failed search left the game in the `searching` phase with the shop locked, and a duplicate or late response could start or restart a battle.

| Requirement | Implementation |
|---|---|
| I see that a search is running | `FightBar` shows "Searching the arena…" and a disabled "Searching…" button while `phase === "searching"`. |
| I cannot start a second search | `fightBlocker` returns "Searching for an opponent" in that phase, and `startSearch` calls it, so the button and the action share one rule. |
| A failed or unavailable API returns me to a usable shop with a message | `searchFailed` goes back to `phase: "shop"` with the error text (the server's own message, or "Opponent search failed (status)" from `api.ts`). |
| I can try again | The phase is `shop` again, so the same button works, and `startSearch` clears the old error. |
| A battle only starts for the current round and search | `startBattle(game, opponent, id)` checks that the phase is `searching`, that `game.searchId === id`, and that `opponent.round === game.run.round`. |
| A slow, duplicate or late response never restarts a battle, starts one outside a search, or applies a result twice | Any other response returns the same state. A second answer finds `searchId` already cleared. The result of a battle is still applied exactly once, when the replay reaches its last frame (`showFrame`). |

### Design

* **`GameState.searchId`** is the id of the running search, or `null`. `ShopPage` makes it (`crypto.randomUUID()`) and passes it to `startSearch`, `startBattle` and `searchFailed`, so each request only ever affects its own search.
* **One guard.** `isCurrentSearch(game, id)` (phase is `searching` and the ids match) is used by both `startBattle` and `searchFailed`. A late answer of an old search, for example after a failure and a retry, has a different id and is ignored.

### Decisions and trade-offs

* **The id lives in the game state** and not in a component, so the rule is pure and can be tested without a browser. Cancelling old requests with `AbortController` would have needed bookkeeping per component.
* **A fast double click can still send a second request.** Its answer is ignored, because `startSearch` refused the second search and its id never matches.
* **Left out on purpose:** automatic retries, a request timeout, a cancel button for the search.

## B6: Save and resume

The run is saved in the browser after every change and restored through one pure function that checks the data. Anything wrong falls back to the start page. The browser storage is touched only in `GameProvider`; `save.ts` works on plain strings, so it is tested without a browser.

### What is saved

| Part | Saved? |
|---|---|
| `run` (round, gold, lives, wins, seed, shop offers, backpack) | yes, all of it |
| `phase` | yes |
| `battle` | only its inputs and position: the opponent, the hero's item ids and the replay `frame`. The frames are recomputed with `simulateBattle`, which is deterministic, so a hand-edited battle cannot crash the battle view. |
| `searchId`, `error` | no, they only mean something while a request is in flight |
| `runId`, `submitted` (B7) | yes, so a refresh on the result page cannot submit the run again |

### The refresh policy

| Where the refresh happens | What the player gets | What it prevents |
|---|---|---|
| In the shop | The same shop. Gold, seed and offers are saved. | A free reroll. |
| During a search | Back in the shop, the search is cancelled. | Nothing was decided yet, and the opponent of a round is fixed, so it cannot give a different opponent. |
| During a battle replay | The replay jumps to its end and the result counts now (`skipReplay`). | Avoiding a loss. |
| After the replay, in the shop window | Exactly as before. `skipReplay` does nothing for a finished replay. | A second result. |
| On the result page | The result page. | |

Saving only "settled" states, such as the shop, was rejected. It would let a player refresh to avoid a loss, or to peek at the next shop after a reroll for free. The rule is shown to the player as a line in the rules panel.

### Where it is in the code

* `serializeGame(game)` and `loadSavedGame(json)` in `save.ts`. `loadSavedGame` returns `null` for no save, bad JSON and anything impossible, and then the game starts at the start page.
* `GameProvider` reads the save once for its initial state and writes it in a `useEffect` on every change. Unavailable storage (private mode, blocked) is ignored.
* The URL is kept by a refresh, so `RequireRoute` puts the player back on the screen that matches the restored phase. `StartPage` shows a "Continue run" button when a game exists, for someone who opens `/`.

### What makes a save "impossible"

All of these are one-line checks in `isPossibleRun`: values must be whole numbers in range (lives 0 to 3, wins 0 to 5), the shop has 4 slots and the backpack 6, only known item ids appear. The round must match the battles played (`1 + wins + lost lives`, or without the `1 +` once the run is over). The phase must match the outcome (a run that is over cannot be in the shop). And gold plus the prices of the owned items can never be more than all the gold the run has earned (`15 + 5 × (round − 1)`).

### Decisions and trade-offs

* **Compact battle save with recompute** instead of saving the frames: smaller, and the saved data cannot describe a battle that the rules could not produce.
* **Policy "the result counts now"** for a replay that was still running, using the existing `skipReplay`, so there is no new rule to maintain.
* **Not defended on purpose:** a player who edits the saved data by hand into a state that is possible but unearned. The checks only make sure that the game does not break and that the run is plausible.
* **A corrupt save is left in place** until a new run overwrites it.

## B7: Hall of fame

At the end of a run the player enters a name and the run is sent to the API. The server checks it, stores it in `server/hall-of-fame.json` and lists the best runs. The hall of fame is its own page at `/hall-of-fame`, linked in the header. The endpoints are documented in `docs/API.md`.

| Requirement | Implementation |
|---|---|
| Enter a name at the end of a run | A form below the end-of-run summary on `ResultPage`. |
| See how it compares | The answer contains the run's rank ("You placed #3"), and the hall of fame page highlights the player's own run. |
| The API stores and lists the best runs in a defined order | `server/hallOfFame.js`: `addRun` stores, `rankRuns` sorts. `GET` returns the top 10. |
| The API rejects invalid or implausible data with a clear error | `validateRun` returns one message per problem, sent as `400 { error }`. |
| Loading, empty and error states | `HallOfFamePage`: "Loading…", "No runs yet", and the error text with a Retry button. The form shows "Submitting…" and the error. |
| Retry without retyping | The name stays in the input after a failure, and the button turns into "Retry". |
| Never submits the same run twice | Three layers, see below. |

### Ranking

More wins first, then fewer rounds. Every victory has 5 wins, so victories always come before defeats, and among victories fewer rounds means fewer lives lost. Two equal runs keep the order they were submitted in, because the sort is stable.

### What the server accepts

| Field | Rule |
|---|---|
| `runId` | non-empty string |
| `name` | 1 to 20 characters after trimming (the input also has `maxLength={20}`) |
| `wins`, `lives` | whole numbers, 0 to 5 and 0 to 3 |
| run is over | exactly one of `wins = 5` and `lives = 0` |
| `rounds` | `wins + (3 − lives)`: every battle is one round, the same rule as `isPossibleRun` in B6 |

The server cannot import the TypeScript rules, so the numbers 5 and 3 are copied into `hallOfFame.js`. The server can only check that the numbers fit together, not that the battles really happened.

### Never twice

1. **While sending**, the button is disabled (`submitBlocker` gets "Submitting…"), so a double click sends one request.
2. **After success**, `markSubmitted` sets `GameState.submitted`. It is saved (B6), so a refresh does not show the form again.
3. **On the server**, every run carries a random `runId` (`crypto.randomUUID()` in `startNewRun`). A `runId` that is already stored is not added again; the stored entry comes back. This covers a request that reached the server while its answer was lost.

`markSubmitted(game, runId)` only applies when `game.runId` matches, the same idea as the B5 `searchId`: if the player starts a new run while the request is still running, the late answer cannot mark the new run.

### Decisions and trade-offs

* **Submission state split by lifetime.** `runId` and `submitted` belong to the run and are saved. `name`, `sending`, `error` and the rank only matter while the result page is open, so they are component state in `ResultPage`.
* **Validation on the server**, which is the authority. The client only blocks an empty name and limits the input to 20 characters.
* **A JSON file instead of memory**, so the hall of fame survives a server restart (the requirement would allow memory). The whole list is read once at start and written again after every submission with `writeFileSync`. That is simple and fine for a small list; Node handles one request at a time, so two writes never overlap. A broken file stops the server with an error instead of silently starting empty and overwriting the old entries. No database, as the requirement allows.
* **No `latency`/`fail` parameters** on the hall-of-fame endpoints. The error state is shown by stopping the API, the loading state with network throttling in the browser.
* **The form is part of `ResultPage`** and not its own component, so the whole submission (state, request, form) is in one file.
* **Left out on purpose:** a database, editing or deleting entries, paging beyond the top 10, and proof that a run was really played.

## Tests

Tests sit next to the code they test (`*.test.ts`, run with `pnpm test`; `server/hallOfFame.test.js` is picked up as well).

| File | Covers |
|---|---|
| `run.test.ts` | Buy, sell, reroll and move: results, blockers, refusal returns the same state, no mutation, and random action sequences that never lose or duplicate an item or make gold negative. |
| `game.test.ts` | `shopLock` for every phase, and that `updateRun` ignores buy, sell, reroll and move while shopping is closed. B5: one search at a time, a battle starts only for the current search and round, duplicate, late and old answers change nothing, and a failure returns to a usable shop. B7: `submitBlocker` (run not over, no name, already submitted) and `markSubmitted` (wrong run ignored, second call changes nothing). |
| `build.test.ts` | `summarizeBuild` rates and the number formatting. |
| `save.test.ts` | Restoring a shop (no free reroll), a cancelled search, a running replay (result counted once, also after a second refresh), a finished replay and a finished run; broken saves (not JSON, an unknown phase, wrong types) and impossible runs (ranges, round, gold, sizes, unknown items, phase against outcome) all give no game. B7: `runId` and `submitted` survive, a save without them is refused. |
| `battle.test.ts` | Poison (duration roll, hurt per tick, ignores block, stacking, knockout, log), burn (damage, block first, decay, stacking, knockout), heal (cap, same-tick damage), same result for any backpack order, catalog has 3 items per effect. |
| `server/hallOfFame.test.js` | `validateRun` accepts victories and defeats and refuses each kind of bad field, `rankRuns` order and ranks, `addRun` trims the name and never stores a `runId` twice. |
| `sets.test.ts` | Catalog has 2+ sets with 3+ items and Fire, set progress, activation at 2 items (duplicates count), bonus only for the set's items, catalog never changed, opponents get bonuses, Fire burns only when active. |

The UI is checked by hand; there are no component tests.
