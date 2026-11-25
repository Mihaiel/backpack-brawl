import { describe, expect, it } from "vitest";
import { advanceReplay, isReplayDone, newGame, skipReplay, startBattle, startSearch, updateRun } from "./game";
import { buyItem, rerollShop } from "./run";
import { loadSavedGame, serializeGame } from "./save";
import type { GameState, Opponent } from "./types";

const opponent: Opponent = { id: "test", name: "Test Dummy", icon: "🧪", hp: 25, round: 1, items: ["chipped-dagger"] };

/** A round 1 shop game that owns two items. */
function shopping(): GameState {
  const game = newGame(1);
  const run = buyItem(buyItem({ ...game.run, shop: ["pot-lid", "chipped-dagger", null, null] }, 0), 1);
  return { ...game, run };
}

const searching = () => startSearch(shopping(), "search-1");
const inBattle = () => startBattle(searching(), opponent, "search-1");
const roundTrip = (game: GameState) => loadSavedGame(serializeGame(game));

describe("resuming a run", () => {
  it("restores a shop exactly, so a refresh gives no free reroll", () => {
    const game = updateRun(shopping(), rerollShop); // gold, offers and seed all changed

    expect(roundTrip(game)).toEqual(game);
  });

  it("cancels a search: back in the shop", () => {
    const restored = roundTrip(searching());

    expect(restored?.phase).toBe("shop");
    expect(restored?.searchId).toBeNull();
    expect(restored?.run).toEqual(searching().run);
  });

  it("counts the result of a replay that was still running, exactly once", () => {
    const running = advanceReplay(inBattle());
    const restored = roundTrip(running)!;

    expect(isReplayDone(restored.battle!)).toBe(true);
    expect(restored.run).toEqual(skipReplay(running).run); // the result is in the run, as if the replay had ended
    expect(roundTrip(restored)?.run).toEqual(restored.run); // refreshing again changes nothing
  });

  it("keeps a finished replay as it was, with its shop window", () => {
    const done = skipReplay(inBattle());

    expect(roundTrip(done)).toEqual(done);
  });

  it("restores a finished run", () => {
    const finished: GameState = { phase: "finished", run: { ...newGame(1).run, wins: 5, round: 5 }, battle: null, searchId: null, error: null };

    expect(roundTrip(finished)).toEqual(finished);
  });
});

describe("a broken save falls back to no game", () => {
  it.each([
    ["nothing saved", null],
    ["not JSON", "{oops"],
    ["not an object", "123"],
    ["an array", "[]"],
    ["an empty object", "{}"],
  ])("%s", (_name, json) => {
    expect(loadSavedGame(json)).toBeNull();
  });

  /** A valid save as an object, to break one detail at a time. */
  const saved = () => JSON.parse(serializeGame(shopping()));
  const load = (data: unknown) => loadSavedGame(JSON.stringify(data));

  it("rejects an unknown phase and wrong types", () => {
    expect(load({ ...saved(), phase: "pause" })).toBeNull();
    expect(load({ ...saved(), run: { ...saved().run, gold: "10" } })).toBeNull();
    expect(load({ ...saved(), run: undefined })).toBeNull();
  });

  it("rejects a battle save that is incomplete or points at unknown items", () => {
    const base = inBattle();
    const battleSave = () => JSON.parse(serializeGame(base));

    expect(load({ ...battleSave(), battle: null })).toBeNull();
    expect(load({ ...battleSave(), battle: { ...battleSave().battle, heroItems: ["no-such-item"] } })).toBeNull();
    expect(load({ ...battleSave(), battle: { ...battleSave().battle, opponent: { ...opponent, hp: -5 } } })).toBeNull();
  });
});

describe("an impossible run falls back to no game", () => {
  const withRun = (change: object, phase = "shop") => {
    const data = JSON.parse(serializeGame(shopping()));
    return loadSavedGame(JSON.stringify({ ...data, phase, run: { ...data.run, ...change } }));
  };

  it("accepts the unchanged run", () => {
    expect(withRun({})).not.toBeNull();
  });

  it.each([
    ["lives out of range", { lives: 4, round: 1 }],
    ["wins out of range", { wins: 6 }],
    ["a round that does not match the battles played", { round: 4 }],
    ["more gold than the run could ever earn", { gold: 999 }],
    ["a backpack of the wrong size", { backpack: [null] }],
    ["an unknown item in the shop", { shop: ["no-such-item", null, null, null] }],
    ["the wrong number of offers", { shop: [null] }],
    ["a run that is over but still in the shop", { wins: 5, round: 5 }],
    ["no lives left but still in the shop", { lives: 0, round: 3 }],
  ])("%s", (_name, change) => {
    expect(withRun(change)).toBeNull();
  });

  it("rejects a finished phase for a run that is not over", () => {
    expect(withRun({}, "finished")).toBeNull();
  });
});
