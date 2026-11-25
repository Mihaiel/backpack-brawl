#import "@preview/ilm:3.0.0": *

#set text(lang: "en")

#show: ilm.with(
  title: [Development Diary],
  authors: (
    "Mihaiel Birta",
    // Add additional authors here.
  ),
  date: datetime(year: 2026, month: 11, day: 25),
  abstract: [
    The following report documents the development of the 'Backpack Brawl' game.\
    \
    *Repository:* https://github.com/Mihaiel/backpack-brawl
  ],
)

// Display cover page.
#cover-page()

// Display table of contents.
#outline()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Status labels for the requirement table.
#let done = text(fill: rgb("#2e7d32"))[*Done*]
#let partial = text(fill: rgb("#ef6c00"))[*Partial*]
#let open = text(fill: rgb("#c62828"))[*Not started*]

// Visible reminder for text that still has to be written or checked.
#let fixme(body) = text(fill: rgb("#c62828"))[*TODO:* #body]

// One colour per requirement, used for the tab above its decisions.
#let req-colors = (
  B1: rgb("#5e9e3a"), // green
  B2: rgb("#3b7dd8"), // blue
  B3: rgb("#8e4bb8"), // purple
  B4: rgb("#e07b1f"), // orange
  B5: rgb("#1f9e9e"), // teal
  B6: rgb("#c2417a"), // pink
  B7: rgb("#a67c00"), // gold
  Refactor: luma(110), // grey, for decisions that belong to no requirement
)

// One boxed entry per significant decision. `req` ("B1" ... "B7") and the
// `date` of the decision become a coloured tab on top of the box, like an
// index tab in a book.
#let decision(req, date, title, background, options, choice, consequences, evidence) = block(
  width: 100%,
  above: 1em,
  below: 1em,
)[
  #block(
    fill: req-colors.at(req),
    inset: (x: 11pt, y: 5pt),
    radius: (top-left: 3pt, top-right: 3pt),
    below: 0pt,
    sticky: true, // keeps the tab together with the start of the box
  )[
    #text(fill: white, size: 1.05em)[*#req* #h(0.4em) | #h(0.4em) #date]
  ]
  #block(
    width: 100%,
    inset: 10pt,
    above: 0pt,
    stroke: 0.5pt + luma(170),
    radius: (top-left: 0pt, top-right: 3pt, bottom: 3pt),
  )[
    == #title
    *Context.* #background \
    *Options considered.* #options \
    *Decision.* #choice \
    *Consequences / trade-offs.* #consequences \
    *Evidence.* #evidence
  ]
]

// Short inline reference to a commit hash.
#let commit(hash) = raw(hash)

// Small coloured label, used in the timeline.
#let tag(label, color) = box(
  fill: color,
  inset: (x: 6pt, y: 3pt),
  radius: 2pt,
  baseline: 2pt,
  text(fill: white, weight: "bold", size: 0.85em, label),
)

// Colour of entries that are not a requirement (setup, documentation).
#let other-color = luma(130)

// One entry of the timeline: date on the left, a dot on the vertical line,
// and a card on the right. `tags` is an array of (label, colour) pairs.
// `planned: true` draws the entry hollow and dashed.
#let timeline-entry(date, tags, title, body, planned: false) = {
  let accent = if tags.len() > 0 { tags.first().at(1) } else { other-color }
  grid(
    columns: (2.2cm, 16pt, 1fr),
    column-gutter: 10pt,
    align(right, text(weight: "bold", date)),
    align(center, circle(
      radius: 6pt,
      fill: if planned { white } else { accent },
      stroke: 2pt + accent,
    )),
    block(
      width: 100%,
      inset: (x: 10pt, y: 8pt),
      radius: 3pt,
      fill: if planned { none } else { accent.lighten(88%) },
      stroke: if planned { (paint: accent, thickness: 1pt, dash: "dashed") } else { (left: 3pt + accent) },
    )[
      #set par(justify: false)
      *#title* #h(6pt) #tags.map(t => tag(t.at(0), t.at(1))).join(h(4pt)) \
      #if planned { text(fill: luma(110), body) } else { body }
    ],
  )
}

// ---------------------------------------------------------------------------
= Development Overview

== How I organised the work

Every requirement is built on its own Git branch (`b1`, `b2`, ...) that starts from the merged `master`. Game rules are written as small pure TypeScript functions that are covered by unit tests placed next to the code (`*.test.ts`). The React UI only draws the state and calls those functions, and it is checked by hand in the browser. The architecture is documented in `ARCHITECTURE.md`.

The requirements are tackled in this order: B1 and B2 first, because they are small and set the patterns (pure functions, blockers, guarded actions) that the later ones reuse. B3 and B4 followed because they only extend the battle engine, then B5. B6 came next, because the saved state had settled by then. Planned last: B7.

== Responsibilities

Since I am working alone on this project, all of the responsibilities are up to me. I need to come up with an an architecture for the whole game in about 5 days of work. A bit rushed bit still doable.

== Requirement status

#table(
  columns: (auto, 1fr, auto, auto, 1fr),
  stroke: 0.5pt + luma(170),
  table.header[*ID*][*Requirement*][*Status*][*Date*][*Notes / evidence*],
  [B1], [Shop economy: sell, reroll],      [#done],  [23 Nov], [Branch `b1`, commit #commit("f8d84f5")],
  [B2], [Backpack arrangement],            [#done],  [23 Nov], [Branch `b2`, commit #commit("bcba98e")],
  [B3], [Status effects: poison, heal],    [#done],  [24 Nov], [Branch `b3`, commit #commit("0ed9411")],
  [B4], [Item sets and Burn],              [#done],  [24 Nov], [Branch `b4`, commit #commit("a7588d5")],
  [B5], [Resilient matchmaking],           [#done],  [25 Nov], [Branch `b5`, commit #commit("892a11a")],
  [B6], [Save and resume],                 [#done],  [25 Nov], [Branch `b6`, commit #commit("dde5276")],
  [B7], [Hall of fame],                    [#open],  [-], [],
)

== Requirements not implemented

Not applicable yet: B7 is still open. #fixme[Update before submission and say why anything is missing.]

// ---------------------------------------------------------------------------
= Timeline

// The block fills the rest of the page, so the vertical line runs over the
// whole page height and the entries are spread evenly along it. Entries that
// are not done yet are placeholders (`planned: true`, hollow and dashed): when
// a requirement is finished, give it a real date and text and drop `planned`.
#block(height: 100% - 5em, width: 100%)[
  #place(top + left, dx: 2.2cm + 10pt + 8pt - 1pt, line(angle: 90deg, length: 100%, stroke: 2pt + luma(200)))
  #grid(
    rows: (1fr,) * 9,
    timeline-entry("22 Nov", (("Setup", other-color),), [Project setup], [Forked the template, read the README and `REQUIREMENTS.md`, and sorted out the Git workflow (branches, `master`, my fork).]),
    timeline-entry("23 Nov", (("B1", req-colors.B1),), [Shop economy], [Selling, rerolling, a blocker for every action, shop after each battle and a hero card. Commit #commit("f8d84f5").]),
    timeline-entry("23 Nov", (("B2", req-colors.B2),), [Backpack arrangement], [Click to select, move or swap, cancel. `ARCHITECTURE.md` and the diary written. Commit #commit("bcba98e").]),
    timeline-entry("24 Nov", (("B3", req-colors.B3),), [Status effects: poison, heal], [Poison (burns every tick, 2-4 ticks) and heal as item effects, 6 new items. Commit #commit("0ed9411").]),
    timeline-entry("24 Nov", (("Refactor", req-colors.Refactor),), [Project restructure], [Pure game rules moved into `src/game/`, with a lint rule that keeps React out. Commit #commit("ac4997b").]),
    timeline-entry("24 Nov", (("B4", req-colors.B4),), [Item sets and Burn], [Fire and Guard sets with a bonus at 2 items, and Burn (hurts for 3 per stack, block absorbs it, decays). Commit #commit("a7588d5").]),
    timeline-entry("25 Nov", (("B5", req-colors.B5),), [Resilient matchmaking], [A search id makes the game ignore late, duplicate and old answers, and a failed search returns to the shop. Commit #commit("892a11a").]),
    timeline-entry("25 Nov", (("B6", req-colors.B6),), [Save and resume], [The run is saved in the browser and restored through a checked pure function, with a policy for a refresh during a search or a replay. Commit #commit("dde5276").]),
    timeline-entry("TBD", (("B7", req-colors.B7),), [Hall of fame], [Planned last. Not started.], planned: true),
  )
]

// ---------------------------------------------------------------------------
= Qualitative Goals

These are the goals I chose, each with how I check it.

- *Correctness.* Gold and items must never be lost or duplicated, and battles must be reproducible. Rules are pure state-to-state functions, and a refused action returns the same state. Checked with unit tests, including random action sequences.
- *Testability.* Many rules need to be verified quickly, and I have to explain the project in the exam. Rules live in plain TypeScript without React and the UI stays thin. Checked with `pnpm test`, lint, type check and build.
- *Usability.* The player should see why an action is not possible and what the numbers mean. Every action has a blocker, so disabled buttons show the reason, and tooltips and the rules panel explain the mechanics. Checked by clicking through every screen.
- *Resilience.* A slow or failing API and a browser refresh must not break or exploit a run. The game ignores late, duplicate and old search answers (B5), and a refresh restores the run through a checked save with a fixed policy (B6). Checked with unit tests for those cases, with broken and impossible saved data, and by refreshing the app in the browser.

// ---------------------------------------------------------------------------
= Architecture Overview

The application is a single page React app with a thin, stateless Express API. All game rules are pure TypeScript in the folder `src/game/` (`run.ts`, `game.ts`, `battle.ts`, `shop.ts`, `build.ts`, ...), and a lint rule forbids React imports there. A run moves through the phases shop, searching, battle and finished. Every shop or backpack action goes through one guard (`shopLock` and `updateRun` in `game.ts`) and then through a rule function in `run.ts` that has a matching blocker. Item sets (B4) are defined in one table in `sets.ts`, applied when a fighter is built, and shown in the interface with the `SetBadge` component. The details, diagrams and the tables for B1 to B4 are in `ARCHITECTURE.md`.

// ---------------------------------------------------------------------------
= Important Decisions

#decision(
  "B1",
  "23 Nov",
  [Decision 1: A blocker for every action, and refused actions change nothing],
  [B1 requires a shop, and along the shop actions that are atomic and that the interface explains why an action is not possible, with the same rule protecting the action itself. The starter's `buyItem` wrote into slot -1 when the backpack was full, so the player paid and lost the item.],
  [(a) Check only in the UI. (b) Throw errors from the rule functions. (c) For each action write a `...Blocker` function that returns the reason or `null`, and make the action return the unchanged state when blocked.],
  [Option (c): `buyBlocker`, `sellBlocker`, `rerollBlocker` and `moveBlocker` in `run.ts`. The action calls its own blocker first and the UI calls the same blocker to disable the button and show the reason.],
  [UI and rule cannot disagree, and tests can assert that a refused action returns the very same object. The cost is one extra function per action.],
  [#commit("f8d84f5"), `run.ts`, `run.test.ts`],
)

#decision(
  "B1",
  "23 Nov",
  [Decision 2: Shopping happens before the first battle and right after each battle],
  [B1 says shop and backpack actions are only possible while shopping. Here I took a bit off, and considered more the UX experience as well. I tested the game around 10-15 minutes and I realised it was a bit annoying to double click from 'Onto round X' to 'Find opponent'. So I wanted the next round's shop to open right after a battle, above the result, instead of hiding it behind a result box. At that point the game is still in the `battle` phase.],
  [(a) Allow actions only in the `shop` phase and put the shop on a separate page after the result. (b) Treat the finished replay as part of shopping. Then lock the build once the player moves on.],
  [Option (b). `shopLock` in `game.ts` opens shopping *ONLY* in round 1 on the shop page and *AFTER* the battle is done. The result became a compact box beside the shop title, and the shop page of round 2 and later shows only a read-only inventory and a hero card.],
  [The shop is used where the player has just seen the result, and the build is clearly fixed once the next round starts. The price is that "while shopping" now means two screens. If the exam expects only the `shop` phase, this single function is the place to change.],
  [#commit("f8d84f5"), `game.ts` (`shopLock`, `updateRun`), `game.test.ts`],
)

#decision(
  "B2",
  "23 Nov",
  [Decision 3: Keep B2 minimal: click to select, selection as UI state],
  [B2 needs select, move, swap, visible possible moves and cancel. Since I was working alone on this, I opted in for a simple approach where the user can click and item and other free available slots would get a a styling that showcased that they can be placed there or swapped with another item.],
  [(a) Drag and drop. (b) Click to select, then click a target. (c) Keep the selection in the game state or only in the component.],
  [Option (b) with the selection as local component state (`selectedUid` in `Backpack.tsx`). The rule is one pure function, `moveItem`, which moves or swaps and reuses the B1 guard. Cancel works by clicking the selected item again or with a Cancel button. Esc and drag and drop were left out on purpose.],
  [Nothing about the selection has to be saved or validated later (B6). Selecting by `uid` keeps the selection valid when items move. A refresh cancels a selection. The click handling is tested by hand only, while `moveItem` is unit tested.],
  [Branch `b2`, `run.ts`, `Backpack.tsx`, `run.test.ts`],
)

#decision(
  "B3",
  "24 Nov",
  [Decision 4: Poison and heal as plain item effects with deterministic rolls],
  [B3 needs the two effects, poison and heal that are shown in battle, to be deterministic, and usable by opponents. I decided on my own that poison should last a random-looking 2 to 4 ticks, but a battle has to give the same result every time, and arranging the backpack must not change a fight.],
  [(a) A generic status-effect system with effect objects, ticking hooks and their own types. (b) Two more fields on `ItemEffects` (`poison`, `heal`) that the existing battle loop resolves. (c) Make the duration a fixed number per item.],
  [Option (b). `poison` adds an application `{ stacks, ticksLeft }` to the enemy. `burnPoison` makes every poisoned fighter lose one HP per active stack at the end of each tick and ignores block. `healItem` heals up to max HP, after all damage of the tick. The duration is `rollPoisonTicks(tick, side)`: a roll of 2 to 4 from the existing `mulberry32`, seeded with the tick and the side.],
  [The whole feature is about 60 lines in `battle.ts` and one new test file, and it can be explained in one diagram of the tick order. The roll is reproducible and cannot depend on item order, so a test can assert that reversing the backpack gives the same battle. The price is that there is no general effect framework, so B4's Burn adds its own small counter. Poison never gets cleansed and its per-stack timers are not shown, only the stack count.],
  [#commit("0ed9411"), `battle.ts`, `battle.test.ts`, `items.ts`, `opponents.js`, `types.ts`, `rules.ts`],
)

#decision(
  "Refactor",
  "24 Nov",
  [Decision 5: Group the pure game rules in `src/game/` and enforce the boundary],
  [After B3 the flat `src/` folder held nine rule files next to UI files such as `api.ts` and `rules.ts`. The main architectural claim, that the rules are plain TypeScript and React only draws them, was visible only in the documentation.],
  [(a) Leave `src/` flat. (b) Move the rules into `src/game/`. (c) A full layered structure with separate folders for data, rules and services.],
  [Option (b), in its own commit made with `git mv`, so Git follows the renames. Tests stay next to their code. An ESLint rule (`no-restricted-imports` for `src/game/`) fails the lint step if a rule file imports React, a component, a page or the state folder.],
  [The boundary is now visible in the file tree and checked automatically, which makes the architecture easy to explain. The price was one mechanical change of import paths and a layout that differs from the starter's README (I updated its file list). Option (c) would have added folders with one or two files each.],
  [#commit("ac4997b"), `eslint.config.js`, `ARCHITECTURE.md` (folder layout)],
)

#decision(
  "B4",
  "24 Nov",
  [Decision 6: Apply set bonuses when the fighter is built, and make Burn one decaying counter],
  [B4 needs sets with a bonus at 2 or more items, for the player and the opponents alike, and Burn as a damage-over-time that is clearly different from poison: more damage, stacks faster, blocked by block, and it decays.],
  [(a) Look up the active sets inside the battle loop on every tick. (b) Resolve the bonus once, when `buildFighter` creates the fighter. For Burn: (c) a list of applications with timers like poison, or (d) one counter that loses a stack every tick.],
  [Options (b) and (d). `applySetBonuses` adds the bonus effects (Fire: +1 burn, Guard: +2 block) to every item of an active set, and the result is an ordinary `Fighter`, so `simulateBattle` knows nothing about sets. Burn is one number that hurts for 3 per stack through the same block-first `hit()` helper as normal damage, then loses 1 stack per tick. The sets themselves are defined in one table, `SETS` in `sets.ts` (id, name, icon and bonus), and each item names its set in `items.ts`. The component `SetBadge` shows which set an item belongs to, in the shop, the backpack, the hero card and the battle view, and it is highlighted while the bonus is active. Two opponents were changed to use Fire items (rounds 3 and 5), so the bonus is visible on both sides.],
  [Opponents get their bonuses for free, because they are built by the same function, and the battle engine only grew by the burn counter. Because all bonuses are decided before the first tick, the order of the backpack still cannot change a fight. The price is that a bonus can only add item effects and cannot react to something during the battle. Burn needs no random roll, which makes it easy to explain next to poison.],
  [#commit("a7588d5"), `sets.ts`, `sets.test.ts`, `SetBadge.tsx`, `battle.ts`, `opponents.js`],
)

#decision(
  "B5",
  "25 Nov",
  [Decision 7: A search id in the game state decides which answer may start a battle],
  [B5 says a battle may only start for the current round and the current search, and a slow, duplicate or late response must never restart a battle, start one outside a search, or apply a result twice. In the starter, `startSearch` could run twice, `searchFailed` left the game stuck in the `searching` phase, and `startBattle` accepted any opponent in any phase.],
  [(a) Cancel old requests with `AbortController` in the component. (b) Keep a request counter in a `useRef` in the page. (c) Keep a search id in `GameState` and let the pure transition functions check it.],
  [Option (c). `startSearch(game, id)` stores the id and is refused while another search runs (`fightBlocker` says why, so the button and the action share one rule). `startBattle` and `searchFailed` take the id and only act if the phase is `searching` and the ids match, and `startBattle` also checks that the opponent is for the current round. A failure goes back to the `shop` phase with the message. The extra rules inside `fightBlocker` (a fight is allowed when there is no gold or nothing in the shop can be bought, so the player can never get stuck) are my own, see the AI usage section.],
  [Every case in the requirement becomes a pure function call that a unit test can check by comparing the returned state with the input, with no browser or fake timers. The price is that a fast double click still sends a second HTTP request, but its answer is ignored. I checked this in the browser with a triple click, which sent three requests and started one battle.],
  [#commit("892a11a"), `game.ts`, `game.test.ts`, `ShopPage.tsx`],
)

#decision(
  "B6",
  "25 Nov",
  [Decision 8: Save the run, recompute the battle, and decide what a refresh means],
  [B6 says a refresh must continue the run on the matching screen, bad saved data must never break the game, and a refresh must not give a free reroll, a different opponent, a second result, or a way to avoid a loss. The game has phases that are not safe to freeze: a search in flight, and a replay whose result is applied only at its last frame.],
  [(a) Save only settled states, such as the shop. (b) Save the whole `GameState` including every battle frame. (c) Save the run and phase, and for a battle only its inputs and replay position, and recompute the frames.],
  [Option (c). `serializeGame` and `loadSavedGame` in `save.ts` are pure, and `GameProvider` writes the save after every change. The policy is: a search is cancelled and the player is back in the shop, a replay that was still running jumps to its end and its result counts at once (the existing `skipReplay`), and a replay that was already done stays as it was. `loadSavedGame` refuses anything that is not a possible run (ranges, sizes, unknown items, a round that does not match the battles played, too much gold, a phase that does not match the outcome) and returns `null`, so the game starts at the start page.],
  [Option (a) would have been the least code, but a refresh could then avoid a loss or give a free peek at the next shop. Option (b) would have needed a deep check of every frame, because a malformed frame can crash the battle view. With (c) the frames come from `simulateBattle`, so they cannot be malformed. The price is that a refresh can cost the player the chance to watch the replay, and that someone who edits the saved data into a possible but unearned state is not stopped.],
  [#commit("dde5276"), `save.ts`, `save.test.ts`, `GameProvider.tsx`, `StartPage.tsx`],
)

// ---------------------------------------------------------------------------
= AI Usage
#image("images/claude-code.png", width: 10%, )
I used Claude Code assistance during this game development. It aided me in the following tasks: 
- *Reviewing* \ The starter code and getting a whole picture of the app's architecture. While it was described a bit how the app was designed, there was no real architecture overview.
- *Coding the architecture behind the requirements* \ I would provide the Agent my recommendation on how to solve a requirement, by suggesting an architecture and narrowing the scope of the implementation.
- *Architecture alternatives*. In some cases, I was not sure if my design choice was best, so I would use the AI to recommend alternatives. I would then analyse which one is best. Overall my analysis went into simplicity, scope, overall integration hassle, as well as UI and UX experience for the user.
- *Generating test cases* \ During the implementation, one of the requirements specified inside `REQUIREMENTS.md` was that unit tests need to be implemented. I used it to generate unit tests for me and also account for other edge test cases that I might have missed.
- *Documentation* \ While I did document most of `ARCHITECTURE.md` by myself, I used generative AI in order to draw ASCII sketches of the architecture. I provided overall a nice overview of the design :)

*Why did I use it?* Well for one part I was doing the whole project alone. Overall tt speeds up repetitive work (tests, boilerplate, documentation) and gives a quick second view on design options, while the decisions stayed with me.

*Who decided what:* the choices about how the game should behave and look came from me: where the shop appears, the shop on the left and the inventory on the right, the compact result box, closing the shop once the next round starts, the hero card with a build summary, keeping B2 minimal, the rolled poison duration, the Fire set values, the rules inside `fightBlocker`, removing the save version, and the plain `if` style of the `restore` function.

*How I checked the output:* unit tests (105 in total which are passing), type check, lint, production build, and clicking through the app in the browser.

*What I changed or rejected:*
1. *B1 layout.* I rejected some design recommendations, as well as multiple UI implementations for B1, since from a UX perspective the experience of playing the game was redundant. The first layout hid the shop behind the result box and kept an open, unusable shop page in later rounds, so both were reworked.

2. *One-click matchmaking.* I tried a flow that merged "On to round X" and "Find opponent" into one button, to remove the redundancy mentioned in point 1. It was built and then reverted before it was committed.

3. *B2 scope.* The AI listed several options (drag and drop, keyboard support, selection kept in the game state). I rejected them and asked for the smallest version that fulfils the requirement: click to select, click a target to move or swap, and the selection as local UI state.

4. *B3 poison rule.* The AI proposed that poison hurts every second tick for a fixed number of ticks. I changed that to my own rule: poison hurts every tick, and each application lasts a rolled 2 to 4 ticks. The AI then made the roll deterministic. I also chose to add new items instead of changing the existing ones.

5. *B4 values and scope.* A simulation by the AI showed that Fire with 2 damage per stack did no more damage than plain items of the same price, and I raised it to 3 myself. I also decided not to add a third (healing) set, because the requirement was already fulfilled and I wanted to keep the project small enough to present.

6. *B5 size.* The AI's first B5 version had a 10 second request timeout, friendlier error messages in `api.ts` and URL parameters for testing slow and failing searches. None of that is required, so I asked for the code to be reduced. `api.ts` was reverted to the starter version, the search state was simplified to a single `searchId`, and the tests were cut from 12 to 6.

7. *My own logic in `fightBlocker`.* For "nothing left to buy" the AI suggested a separate helper function and warned that blocking the fight button when nothing is buyable could leave the player stuck. I did not want a separate function, and I wrote the logic myself inside `fightBlocker` in `game.ts`:
   - with no gold, a fight is allowed (`return null`),
   - while a search runs, the reason "Searching for an opponent" is returned,
   - the offers are checked with `buyBlocker`, and if every offer is blocked, a fight is allowed too, so the player can never get stuck in a shop they cannot use,
   - otherwise, if the backpack is empty, the player is reminded to buy an item.
   The consequence is that a player with no gold, or with nothing affordable, can fight with an empty backpack. The AI also pointed out two problems in my version. With no gold, `return null` comes before the "searching" check, so a second search can be started during a search, which B5 forbids. Also, `game.run.shop.length == 0` can never be true, because the shop always has 4 slots. At the time of writing, the code is unchanged, and the first problem is a known issue.

8. *B6 save version.* The AI's save format had a `version` number, so that a save made by an older format would be refused. I asked what it was for. The AI explained that the other checks already reject most incompatible data, and that the number only helps when the shape stays valid but its meaning changes, which I do not expect in this project. I decided it was not necessary, and the AI removed it, together with its test.

9. *B6 `restore` style.* The AI wrote the phase checks in `restore` as one-line conditional expressions. I found them hard to read and asked for a more primitive version, so I can explain it in the exam. It was rewritten with plain `if` blocks and the same behaviour.

10. *B6 limits that I accepted.* The AI recommended the compact battle save, the refresh policy and the "Continue run" button, and I accepted them. It also pointed out two gaps: a player who has the game open in two tabs can overwrite a lost battle with the other tab's older state, and a hand-edited save that is possible but unearned is not stopped. The AI suggested listening for the browser's `storage` event as the fix for the first one. I did not implement it. Both are listed as known limitations.

11. *Test page.* The AI recommended a development-only `/dev` page with controls for failing searches, broken saves and battle simulation, and then recommended doing B5 first. I followed that, and I did not build the page. I tested by hand with the API stopped, with `API_FAIL=true pnpm server`, and by editing the saved data in the browser console.

#fixme[Keep this section up to date for B7.]

// ---------------------------------------------------------------------------
= Final Reflection and Lessons Learned

So far: keeping the rules as pure functions with blockers made the UI easy to build and test, and fixing a bug in the starter (the full backpack) showed that the requirement text is precise and worth reading closely. Hand-checking the UI found layout problems that no unit test would catch, so a quick click-through belongs after every change.

#fixme[Write the final reflection after the remaining requirements are done.]

// ---------------------------------------------------------------------------
= Appendix: Evidence

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt + luma(170),
  table.header[*Reference*][*What it shows*],
  [#commit("f8d84f5")], [B1: shop economy, post-battle shop, hero card (branch `b1`, merged into `master`).],
  [#commit("bcba98e")], [B2: backpack arrangement, `ARCHITECTURE.md` and diary update (branch `b2`).],
  [#commit("0ed9411")], [B3: poison and heal, 6 new items, `battle.test.ts` (branch `b3`).],
  [#commit("a7588d5")], [B4: item sets (Fire, Guard) and Burn, `sets.ts`, `sets.test.ts`, `SetBadge.tsx` (branch `b4`).],
  [#commit("892a11a")], [B5: resilient matchmaking, search id guard in `game.ts`, `game.test.ts` (branch `b5`).],
  [#commit("dde5276")], [B6: save and resume, `save.ts`, `save.test.ts`, `GameProvider.tsx` (branch `b6`).],
  [#commit("ac4997b")], [Restructure: pure rules in `src/game/` and the lint rule that guards the boundary.],
  [`pnpm test`], [105 unit tests passing at the time of writing (`run`, `game`, `build`, `battle`, `sets` and `save` tests).],
)