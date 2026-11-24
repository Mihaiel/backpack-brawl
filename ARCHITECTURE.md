# Architecture

## Overall

The current architecture of the web application is a SPA with stateless API calls.
* All game rules are pure TypeScript with no React imports.
* React is only a rendering and wiring layer.

```text
┌───────────────────────── Browser (Vite :5174) ─────────────────────────┐
│ main.tsx → <GameProvider> (useState<GameState|null>) → RouterProvider  │
│                                                                        │
│ pages/       Start  Shop  Battle  Result    (Layout + RequireRoute)    │
│ components/  RunHeader FightBar RulesPanel BattleView RunOver          │
│              ShopArea → Shop, Backpack, HeroCard, ItemCard             │
│─────────────── pure rules layer (no React) ────────────────────────────│
│ game.ts    phase transitions, shopLock + updateRun guard, routeForGame │
│ run.ts     economy + backpack: buy, sell, reroll, move, outcome        │
│ shop.ts    mulberry32 PRNG, rollShop, grid size                        │
│ battle.ts  buildFighter, simulateBattle (ticks)                        │
│ build.ts   summarizeBuild (numbers on the hero card)                   │
│ items.ts   CATALOG, getItem      rules.ts  tooltip/rule texts          │
│ api.ts     fetchOpponent(round)                                        │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ /api (Vite proxy → :4200)
                      ┌─────────▼──────────┐
                      │ Express server     │  GET /api/health
                      │ server/index.js    │  GET /api/opponents?round=
                      │ opponents.js table │  stateless, latency/fail params
                      └────────────────────┘
```

## Game state machine

```text
 (no game) ──startNewRun──▶ shop ──startSearch──▶ searching ──startBattle──▶ battle
                             ▲                        │ (searchFailed: error only)
                             │                        ▼
                             └──── leaveBattle ◀── replay done ──▶ finished (victory / defeat)
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
* **Open point for B6:** a reroll consumes the stored seed, so when save and resume is added, the new seed must be saved together with the gold, or a refresh would give a free reroll.

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

## Tests

Tests sit next to the code they test (`*.test.ts`, run with `pnpm test`).

| File | Covers |
|---|---|
| `run.test.ts` | Buy, sell, reroll and move: results, blockers, refusal returns the same state, no mutation, and random action sequences that never lose or duplicate an item or make gold negative. |
| `game.test.ts` | `shopLock` for every phase, and that `updateRun` ignores buy, sell, reroll and move while shopping is closed. |
| `build.test.ts` | `summarizeBuild` rates and the number formatting. |
| `battle.test.ts` | Poison (duration roll, burn per tick, ignores block, stacking, knockout, log), heal (cap, same-tick damage), same result for any backpack order, catalog has 3 items per effect. |

The UI is checked by hand; there are no component tests.
