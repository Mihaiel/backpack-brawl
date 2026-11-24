import { describe, expect, it } from "vitest";
import { buildFighter, buildOpponentFighter, simulateBattle } from "./battle";
import { CATALOG, getItem } from "./items";
import { activeSetIds, SET_MIN_ITEMS, SETS, setProgress } from "./sets";
import type { Opponent } from "./types";

const effectsOf = (fighter: ReturnType<typeof buildFighter>, itemId: string) => fighter.items.find((i) => i.itemId === itemId)?.effects;

describe("the catalog", () => {
  it("has at least 2 sets, with at least 3 items each, and one of them is Fire", () => {
    expect(SETS.length).toBeGreaterThanOrEqual(2);
    expect(SETS.some((set) => set.id === "fire")).toBe(true);
    for (const set of SETS) {
      expect(CATALOG.filter((item) => item.set === set.id).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("set progress", () => {
  it("counts items per set and leaves out sets without items", () => {
    const progress = setProgress(["ember-dagger", "pot-lid", "chipped-dagger"]);

    expect(progress.map(({ set, count, active }) => [set.id, count, active])).toEqual([
      ["fire", 1, false],
      ["guard", 1, false],
    ]);
  });

  it(`is active from ${SET_MIN_ITEMS} items on, and duplicates count`, () => {
    expect(activeSetIds(["pot-lid"])).toEqual([]);
    expect(activeSetIds(["pot-lid", "pot-lid"])).toEqual(["guard"]);
    expect(activeSetIds(["ember-dagger", "cinder-bow", "magma-cleaver"])).toEqual(["fire"]);
  });
});

describe("set bonuses when a fighter is built", () => {
  it("add nothing below the minimum", () => {
    const fighter = buildFighter(["ember-dagger", "chipped-dagger"], 40);

    expect(fighter.activeSets).toEqual([]);
    expect(effectsOf(fighter, "ember-dagger")).toEqual({ damage: 2 });
  });

  it("give every Fire item +1 burn once two Fire items are there", () => {
    const fighter = buildFighter(["ember-dagger", "cinder-bow"], 40);

    expect(fighter.activeSets).toEqual(["fire"]);
    expect(effectsOf(fighter, "ember-dagger")).toEqual({ damage: 2, burn: 1 });
    expect(effectsOf(fighter, "cinder-bow")).toEqual({ damage: 3, burn: 1 });
  });

  it("only change the items of the active set", () => {
    const fighter = buildFighter(["ember-dagger", "cinder-bow", "chipped-dagger", "pot-lid"], 40);

    expect(effectsOf(fighter, "chipped-dagger")).toEqual({ damage: 3 });
    expect(effectsOf(fighter, "pot-lid")).toEqual({ block: 2 }); // Guard has only one item here
  });

  it("let Guard add block, including to items that also deal damage", () => {
    const fighter = buildFighter(["oak-buckler", "spiked-shield"], 40);

    expect(effectsOf(fighter, "oak-buckler")).toEqual({ block: 6 });
    expect(effectsOf(fighter, "spiked-shield")).toEqual({ damage: 3, block: 5 });
  });

  it("never change the catalog", () => {
    buildFighter(["ember-dagger", "cinder-bow"], 40);

    expect(getItem("ember-dagger").effects).toEqual({ damage: 2 });
  });

  it("apply to opponents as well", () => {
    const opponent: Opponent = { id: "test", name: "Test", icon: "🧪", hp: 30, round: 1, items: ["ember-dagger", "magma-cleaver"] };

    expect(buildOpponentFighter(opponent).activeSets).toEqual(["fire"]);
  });
});

describe("the Fire set in a battle", () => {
  const dummy = () => buildFighter([], 100, "Dummy");

  it("burns the enemy only when the set is active", () => {
    const withSet = simulateBattle(buildFighter(["ember-dagger", "cinder-bow"], 100), dummy());
    const alone = simulateBattle(buildFighter(["ember-dagger"], 100), dummy());

    expect(withSet.events.some((e) => e.kind === "burn")).toBe(true);
    expect(alone.events.some((e) => e.kind === "burn")).toBe(false);
  });
});
