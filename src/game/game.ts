import { buildOpponentFighter, buildPlayerFighter, simulateBattle } from "./battle";
import { applyBattleResult, newRun, runOutcome, buyBlocker } from "./run";
import { itemIdsOf } from "./shop";
import type { BattleReplay, GameState, Opponent, RunState } from "./types";

/**
 * Phase transitions of one run: shop → searching → battle → shop … → finished.
 * Every function is pure, so they can be passed straight to `setState`.
 */


// ========== NEW GAME STARTS HERE ==========

export function newGame(seed: number): GameState {
  // Before B5: return { phase: "shop", run: newRun(seed), battle: null, error: null };
  return { phase: "shop", run: newRun(seed), battle: null, searchId: null, error: null };
}

// ==============================

/**
 * Whether the shop page offers shopping at all: only before the first battle.
 * From round 2 on, shopping happens on the battle page right after a battle,
 * so the shop page just shows the locked-in backpack and the fight button.
 */
export const shopPageOffersShop = (run: RunState) => run.round === 1;

/** B1
 * Why shop and backpack actions are locked right now, or `null` while shopping.
 * Shopping happens on the shop page before the first battle, and on the
 * battle page once a replay has finished (the next round's shop opens there).
 * After the player moves on to round 2 or later, the build is locked in.
 */
export function shopLock(game: GameState): string | null {
  switch (game.phase) {
    case "shop":
      return shopPageOffersShop(game.run) ? null : "Shop closed for this round";
    case "searching":
      return "Searching for an opponent";
    case "battle":
      if (!game.battle || !isReplayDone(game.battle)) return "Battle in progress";
      return runOutcome(game.run) ? "The run is over" : null;
    case "finished":
      return "The run is over";
  }
}

/** Applies a shop/backpack action; only allowed while shopping. */
export function updateRun(game: GameState, action: (run: RunState) => RunState): GameState {
  if (shopLock(game) !== null) return game;
  const run = action(game.run);
  return run === game.run ? game : { ...game, run };
}

/** Why the player can't look for an opponent right now, or `null` if they can. */
export function fightBlocker(game: GameState): string | null {
  if (game.run.gold == 0) return null;
  if (game.run.shop.length == 0) return null;
  if (game.phase === "searching") return "Searching for an opponent";

  // Are the items buyable?
  let not_buyable = 0;
  for (let index = 0; index < game.run.shop.length; index++) {
    if (buyBlocker(game.run, index) !== null) not_buyable +=1;
  }
  if (not_buyable == game.run.shop.length) return null;

  // If none of hte above, and the backpack is empty, kind of remind the user to buy an item.
  else if (itemIdsOf(game.run.backpack).length === 0) return "Backpack is empty. Buy an item.";
  return null;
}

// B5: starts search id; refused (same state) while another search runs 
export function startSearch(game: GameState, id: string): GameState {
  if (fightBlocker(game) !== null) return game;
  return { ...game, phase: "searching", searchId: id, error: null };
}

// B5: only the response of the search that is running right now may change the game.
// B5: This is where the check happens, we check if it matches the already existing id inside the gameState and if not,
// we just drop it (which happens in the next function underneath called searchFailed)
const isCurrentSearch = (game: GameState, id: string) => game.phase === "searching" && game.searchId === id;

/** B5: the search failed: back to a usable shop with the message. Answers of old searches are ignored. */
export function searchFailed(game: GameState, id: string, error: string): GameState {
  if (!isCurrentSearch(game, id)) return game;
  return { ...game, phase: "shop", searchId: null, error };
}

/**
 * Simulates the battle against `opponent` and starts its replay at the first frame.
 * B5: ignored unless it answers the current search for the current round, so a slow,
 * duplicate or late response can never start or restart a battle.
 */
export function startBattle(game: GameState, opponent: Opponent, id: string): GameState {
  if (!isCurrentSearch(game, id) || opponent.round !== game.run.round) return game;
  const player = buildPlayerFighter(game.run.backpack);
  const enemy = buildOpponentFighter(opponent);
  const result = simulateBattle(player, enemy);
  return { ...game, phase: "battle", searchId: null, battle: { opponent, player, enemy, result, frame: 0 } };
}

export const isReplayDone = (battle: BattleReplay) => battle.frame >= battle.result.frames.length - 1;

/** Shows the given frame; reaching the last frame applies the battle result to the run (exactly once). */
export function showFrame(game: GameState, frame: number): GameState {
  const { battle } = game;
  if (game.phase !== "battle" || !battle || isReplayDone(battle)) return game;
  const last = battle.result.frames.length - 1;
  const next = { ...battle, frame: Math.min(Math.max(frame, battle.frame), last) };
  if (!isReplayDone(next)) return { ...game, battle: next };
  return { ...game, battle: next, run: applyBattleResult(game.run, battle.result.winner) };
}

export const advanceReplay = (game: GameState) => showFrame(game, (game.battle?.frame ?? 0) + 1);
export const skipReplay = (game: GameState) => showFrame(game, Infinity);

/** Leaves a finished replay: back to the shop, or to the end screen if the run is over. */
export function leaveBattle(game: GameState): GameState {
  if (game.phase !== "battle" || !game.battle || !isReplayDone(game.battle)) return game;
  return { ...game, phase: runOutcome(game.run) ? "finished" : "shop", battle: null };
}

/** URL paths of the app's screens. */
export const ROUTES = { start: "/", shop: "/shop", battle: "/battle", result: "/result" } as const;
export type GameRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * The screen that matches the game's phase. Shop, battle and result pages
 * redirect here when they don't match, so the URL always follows the phase.
 */
export function routeForGame(game: GameState | null): GameRoute {
  if (!game) return ROUTES.start;
  switch (game.phase) {
    case "shop":
    case "searching":
      return ROUTES.shop;
    case "battle":
      return ROUTES.battle;
    case "finished":
      return ROUTES.result;
  }
}
