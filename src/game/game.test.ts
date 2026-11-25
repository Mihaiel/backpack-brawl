import { describe, expect, it } from "vitest";
import {
  advanceReplay,
  fightBlocker,
  isReplayDone,
  leaveBattle,
  newGame,
  searchFailed,
  shopPageOffersShop,
  shopLock,
  skipReplay,
  startBattle,
  startSearch,
  updateRun,
} from "./game";
import { buyItem, moveItem, rerollShop, sellItem } from "./run";
import type { GameState, Opponent } from "./types";

const opponent: Opponent = { id: "test", name: "Test Dummy", icon: "🧪", hp: 25, round: 1, items: ["chipped-dagger"] };

/** A run in the shop phase that already owns an item, so it may look for an opponent. */
function shopping(): GameState {
  const game = newGame(1);
  return { ...game, run: { ...buyItem({ ...game.run, shop: ["pot-lid", null, null, null] }, 0) } };
}

const searching = () => startSearch(shopping(), "search-1");
const inBattle = () => startBattle(searching(), opponent, "search-1");
const afterBattle = () => skipReplay(inBattle());

describe("shopLock", () => {
  it("is open while shopping", () => {
    expect(shopLock(shopping())).toBeNull();
  });

  it("is closed on the shop page of round 2 and later, after moving on from a battle", () => {
    const left = leaveBattle(afterBattle());
    expect(left.phase).toBe("shop");
    expect(left.run.round).toBe(2);
    expect(shopLock(left)).toBe("Shop closed for this round");
  });

  it("is locked while searching for an opponent", () => {
    expect(shopLock(searching())).toBe("Searching for an opponent");
  });

  it("is locked while a battle is replaying", () => {
    const game = advanceReplay(inBattle());
    expect(isReplayDone(game.battle!)).toBe(false);
    expect(shopLock(game)).toBe("Battle in progress");
  });

  it("opens again once the replay is done and the run goes on", () => {
    const game = afterBattle();
    expect(game.phase).toBe("battle");
    expect(game.run.round).toBe(2);
    expect(shopLock(game)).toBeNull();
  });

  it("stays locked when the battle ended the run", () => {
    const game = afterBattle();
    const over: GameState = { ...game, run: { ...game.run, lives: 0 } };
    expect(shopLock(over)).toBe("The run is over");
    expect(shopLock({ ...over, phase: "finished", battle: null })).toBe("The run is over");
  });
});

describe("shopPageOffersShop", () => {
  it("is true only in round 1", () => {
    expect(shopPageOffersShop(shopping().run)).toBe(true);
    expect(shopPageOffersShop(leaveBattle(afterBattle()).run)).toBe(false);
  });
});

describe("updateRun", () => {
  it("applies buy, sell and reroll while shopping", () => {
    const game = shopping();
    const rerolled = updateRun(game, rerollShop);
    expect(rerolled.run.gold).toBe(game.run.gold - 1);
    const sold = updateRun(game, (run) => sellItem(run, 0));
    expect(sold.run.gold).toBe(game.run.gold + 1);
    expect(sold.run.backpack[0]).toBeNull();
    const bought = updateRun({ ...game, run: { ...game.run, shop: ["pot-lid", null, null, null] } }, (run) => buyItem(run, 0));
    expect(bought.run.backpack.filter(Boolean)).toHaveLength(2);
  });

  it("ignores every action while searching", () => {
    const game = searching();
    expect(updateRun(game, rerollShop)).toBe(game);
    expect(updateRun(game, (run) => sellItem(run, 0))).toBe(game);
    expect(updateRun(game, (run) => buyItem(run, 0))).toBe(game);
  });

  it("ignores every action while a battle is replaying", () => {
    const game = inBattle();
    expect(updateRun(game, rerollShop)).toBe(game);
    expect(updateRun(game, (run) => sellItem(run, 0))).toBe(game);
  });

  it("ignores every action once the run is finished", () => {
    const game: GameState = { ...shopping(), phase: "finished" };
    expect(updateRun(game, rerollShop)).toBe(game);
  });

  it("lets the player arrange the backpack while shopping, and only then", () => {
    const base = shopping();
    const run = { ...base.run, backpack: [base.run.backpack[0], null, null, null, null, null] };
    const game = { ...base, run };
    expect(updateRun(game, (r) => moveItem(r, 0, 4)).run.backpack[4]).toBe(run.backpack[0]);
    const locked = searching();
    expect(updateRun(locked, (r) => moveItem(r, 0, 4))).toBe(locked);
    const closed = leaveBattle(afterBattle());
    expect(updateRun(closed, (r) => moveItem(r, 0, 4))).toBe(closed);
  });

  it("keeps the same game object when the action is refused", () => {
    const game = shopping();
    expect(updateRun(game, (run) => sellItem(run, 5))).toBe(game); // empty slot
    const broke: GameState = { ...game, run: { ...game.run, gold: 0 } };
    expect(updateRun(broke, rerollShop)).toBe(broke);
  });

  it("refuses buy, sell and reroll after the player moved on to the next round", () => {
    const left = leaveBattle(afterBattle());
    expect(updateRun(left, rerollShop)).toBe(left);
    expect(updateRun(left, (run) => sellItem(run, 0))).toBe(left);
    expect(updateRun(left, (run) => buyItem(run, 0))).toBe(left);
  });

  it("keeps purchases made after a battle when the player moves on to the shop", () => {
    const game = afterBattle();
    const bought = updateRun({ ...game, run: { ...game.run, shop: ["oak-buckler", null, null, null], gold: 10 } }, (run) => buyItem(run, 0));
    const left = leaveBattle(bought);
    expect(left.phase).toBe("shop");
    expect(left.run.backpack.filter(Boolean)).toHaveLength(2);
    expect(left.run.gold).toBe(7);
  });
});

// B5: a battle only ever starts for the current search.
describe("searching for an opponent", () => {
  it("refuses a second search while one is running", () => {
    const game = searching();

    expect(fightBlocker(game)).toBe("Searching for an opponent");
    expect(startSearch(game, "search-2")).toBe(game);
  });

  it("starts the battle when the current search is answered", () => {
    const game = inBattle();

    expect(game.phase).toBe("battle");
    expect(game.searchId).toBeNull();
    expect(game.battle?.opponent).toBe(opponent);
  });

  it("ignores answers from another search, for another round, or outside a search", () => {
    const game = searching();

    expect(startBattle(game, opponent, "old-search")).toBe(game);
    expect(startBattle(game, { ...opponent, round: 2 }, "search-1")).toBe(game);
    expect(startBattle(shopping(), opponent, "search-1").phase).toBe("shop");
  });

  it("never restarts a battle: a duplicate or late answer changes nothing", () => {
    const replaying = advanceReplay(inBattle());
    const done = afterBattle();

    expect(startBattle(replaying, opponent, "search-1")).toBe(replaying);
    expect(startBattle(done, opponent, "search-1")).toBe(done);
  });

  it("goes back to a usable shop when the search fails, and clears the message on retry", () => {
    const failed = searchFailed(searching(), "search-1", "The arena gates are shut.");

    expect(failed.phase).toBe("shop");
    expect(failed.error).toBe("The arena gates are shut.");
    expect(shopLock(failed)).toBeNull();
    expect(startSearch(failed, "search-2").error).toBeNull();
  });

  it("ignores the failure or the late answer of an old search", () => {
    const retry = startSearch(searchFailed(searching(), "search-1", "timeout"), "search-2");

    expect(searchFailed(retry, "search-1", "late error")).toBe(retry);
    expect(startBattle(retry, opponent, "search-1")).toBe(retry);
    expect(startBattle(retry, opponent, "search-2").phase).toBe("battle");
  });
});
