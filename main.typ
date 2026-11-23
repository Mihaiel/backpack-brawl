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
)

// One boxed entry per significant decision. `req` ("B1" ... "B7") becomes a
// coloured tab on top of the box, like an index tab in a book.
#let decision(req, title, background, options, choice, consequences, evidence) = block(
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
    #text(fill: white, weight: "bold", size: 1.05em)[#req]
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

// ---------------------------------------------------------------------------
= Development Overview

== How I organised the work

Every requirement is built on its own Git branch (`b1`, `b2`, ...) that starts from the merged `master`. Game rules are written as small pure TypeScript functions that are covered by unit tests placed next to the code (`*.test.ts`). The React UI only draws the state and calls those functions, and it is checked by hand in the browser. The architecture is documented in `ARCHITECTURE.md`.

The requirements are tackled in this order: B1 and B2 first, because they are small and set the patterns (pure functions, blockers, guarded actions) that the later ones reuse. Planned next: B5, then B3 and B4 (battle engine), B7 and finally B6, once the saved state has settled.

== Responsibilities

Since I am working alone on this project, all of the responsibilities are up to me. I need to come up with an an architecture for the whole game in about 5 days of work. A bit rushed bit still doable.

== Requirement status

#table(
  columns: (auto, 1fr, auto, 1fr),
  stroke: 0.5pt + luma(170),
  table.header[*ID*][*Requirement*][*Status*][*Notes / evidence*],
  [B1], [Shop economy: sell, reroll],      [#done],  [Branch `b1`, commit #commit("f8d84f5")],
  [B2], [Backpack arrangement],            [#done],  [Branch `b2`, #fixme[add commit hash]],
  [B3], [Status effects: poison, heal],    [#open],  [],
  [B4], [Item sets and Burn],              [#open],  [],
  [B5], [Resilient matchmaking],           [#open],  [],
  [B6], [Save and resume],                 [#open],  [],
  [B7], [Hall of fame],                    [#open],  [],
)

== Requirements not implemented

Not applicable yet: B3 to B7 are still open. #fixme[Update before submission and say why anything is missing.]

// ---------------------------------------------------------------------------
= Qualitative Goals

These are the goals I chose. The evidence column states how I check them. Goals that depend on requirements that are not built yet are marked as planned.

#table(
  columns: (auto, 1fr, 1fr, 1fr),
  stroke: 0.5pt + luma(170),
  table.header[*Goal*][*Why it matters here*][*Decisions / trade-offs*][*How I evaluate it*],
  [Correctness],
  [The economy and the backpack must never lose gold or items, and battles must be reproducible.],
  [Rules are pure state-to-state functions. A refused action returns the same state object, so nothing is half-applied.],
  [Unit tests, including random action sequences that check gold and item invariants.],

  [Testability],
  [Many rules must be verified quickly, and the project has to be explainable in the exam.],
  [Rules live in plain TypeScript modules without React. The UI is thin.],
  [`pnpm test`, lint, type check and build all pass.],

  [Usability],
  [Players should understand why an action is not possible and what the numbers mean.],
  [Every action has a blocker; disabled buttons show the reason. Tooltips and a rules panel explain mechanics.],
  [Manual walk-through of each screen. Accessibility checks are still open.],

  [Resilience (planned)],
  [Slow or failing API and refreshes must not break or exploit a run.],
  [To be decided with B5 and B6.],
  [`?fail=true`, `?latency=5000`, corrupted saved data. Not built yet.],
)

// ---------------------------------------------------------------------------
= Architecture Overview

The application is a single page React app with a thin, stateless Express API. All game rules are pure TypeScript (`run.ts`, `game.ts`, `battle.ts`, `shop.ts`, `build.ts`). A run moves through the phases shop, searching, battle and finished. Every shop or backpack action goes through one guard (`shopLock` and `updateRun` in `game.ts`) and then through a rule function in `run.ts` that has a matching blocker. The details, diagrams and the tables for B1 and B2 are in `ARCHITECTURE.md`.

// ---------------------------------------------------------------------------
= Important Decisions

#decision(
  "B1",
  [Decision 1: A blocker for every action, and refused actions change nothing],
  [B1 requires a shop, and along the shop actions that are atomic and that the interface explains why an action is not possible, with the same rule protecting the action itself. The starter's `buyItem` wrote into slot -1 when the backpack was full, so the player paid and lost the item.],
  [(a) Check only in the UI. (b) Throw errors from the rule functions. (c) For each action write a `...Blocker` function that returns the reason or `null`, and make the action return the unchanged state when blocked.],
  [Option (c): `buyBlocker`, `sellBlocker`, `rerollBlocker` and `moveBlocker` in `run.ts`. The action calls its own blocker first and the UI calls the same blocker to disable the button and show the reason.],
  [UI and rule cannot disagree, and tests can assert that a refused action returns the very same object. The cost is one extra function per action.],
  [#commit("f8d84f5"), `run.ts`, `run.test.ts`],
)

#decision(
  "B1",
  [Decision 2: Shopping happens before the first battle and right after each battle],
  [B1 says shop and backpack actions are only possible while shopping. Here I took a bit off, and considered more the UX experience as well. I tested the game around 10-15 minutes and I realised it was a bit annoying to double click from 'Onto round X' to 'Find opponent'. So I wanted the next round's shop to open right after a battle, above the result, instead of hiding it behind a result box. At that point the game is still in the `battle` phase.],
  [(a) Allow actions only in the `shop` phase and put the shop on a separate page after the result. (b) Treat the finished replay as part of shopping. Then lock the build once the player moves on.],
  [Option (b). `shopLock` in `game.ts` opens shopping *ONLY* in round 1 on the shop page and *AFTER* the battle is done. The result became a compact box beside the shop title, and the shop page of round 2 and later shows only a read-only inventory and a hero card.],
  [The shop is used where the player has just seen the result, and the build is clearly fixed once the next round starts. The price is that "while shopping" now means two screens. If the exam expects only the `shop` phase, this single function is the place to change.],
  [#commit("f8d84f5"), `game.ts` (`shopLock`, `updateRun`), `game.test.ts`],
)

#decision(
  "B2",
  [Decision 3: Keep B2 minimal: click to select, selection as UI state],
  [B2 needs select, move, swap, visible possible moves and cancel. Since I was working alone on this, I opted in for a simple approach where the user can click and item and other free available slots would get a a styling that showcased that they can be placed there or swapped with another item.],
  [(a) Drag and drop. (b) Click to select, then click a target. (c) Keep the selection in the game state or only in the component.],
  [Option (b) with the selection as local component state (`selectedUid` in `Backpack.tsx`). The rule is one pure function, `moveItem`, which moves or swaps and reuses the B1 guard. Cancel works by clicking the selected item again or with a Cancel button. Esc and drag and drop were left out on purpose.],
  [Nothing about the selection has to be saved or validated later (B6). Selecting by `uid` keeps the selection valid when items move. A refresh cancels a selection. The click handling is tested by hand only, while `moveItem` is unit tested.],
  [Branch `b2`, `run.ts`, `Backpack.tsx`, `run.test.ts`],
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

*Who decided what:* the choices about how the game should behave and look came from me: where the shop appears, the shop on the left and the inventory on the right, the compact result box, closing the shop once the next round starts, the hero card with a build summary, and keeping B2 minimal.

*How I checked the output:* unit tests (45 in total which are passing), type check, lint, production build, and clicking through the app in the browser.

*What I changed or rejected:* 
1. I rejected some design recommendations, as well as multiple UI implementations for B1, since from a UX perspective, the experience of playing the game was redundant. The first layout hid the shop behind the result box and kept an open, unusable shop page in later rounds, so both were reworked. 

2. A one-click matchmaking flow (merging "On to round X" and "Find opponent" into one button, so removing the redundancy mentioned above in point 1). This was built and then reverted before it was committed.

#fixme[Adapt this section to how the work really went, and keep it up to date for B3 to B7.]

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
  [Branch `b2`], [B2: backpack arrangement. #fixme[Add the commit hash when committed.]],
  [`pnpm test`], [45 unit tests passing at the time of writing (`run`, `game` and `build` tests).],
)
