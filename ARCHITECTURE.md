# Architecture

## Overall

The current architecture of the web application is a SPA with stateless API calls.
* All game rules are pure TypeScript with no React imports.
* React is only a rendering and wiring layer.

┌───────────────────────── Browser (Vite :5174) ─────────────────────────┐
│ main.tsx → <GameProvider> (useState<GameState|null>) → RouterProvider  │
│                                                                        │
│ pages/          Start  Shop  Battle  Result   (Layout + RequireRoute)  │
│ components/     RunHeader Shop Backpack ItemCard FightBar RulesPanel   │
│                 BattleView RunOver              (presentational)       │
│ ─────────────── pure rules layer (no React) ───────────────────────────│
│ game.ts    phase transitions + routeForGame                            │
│ run.ts     economy: newRun, buyItem, applyBattleResult, outcome        │
│ shop.ts    mulberry32 PRNG, rollShop, grid size                        │
│ battle.ts  buildFighter, simulateBattle (ticks)                        │
│ items.ts   CATALOG, getItem   rules.ts  tooltip/rule texts             │
│ api.ts     fetchOpponent(round)                                        │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ /api (Vite proxy → :4200)
                      ┌─────────▼──────────┐
                      │ Express server     │  GET /api/health
                      │ server/index.js    │  GET /api/opponents?round=
                      │ opponents.js table │  stateless, latency/fail params
                      └────────────────────┘

## Game state machine

 (no game) ──startNewRun──▶ shop ──startSearch──▶ searching ──startBattle──▶ battle
                             ▲                        │ (searchFailed: error only)
                             │                        ▼
                             └──── leaveBattle ◀── replay done ──▶ finished (victory / defeat)

