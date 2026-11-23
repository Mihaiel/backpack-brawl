import { describe, expect, it } from "vitest";
import { getItem } from "./items";
import {
  buyBlocker,
  buyItem,
  newRun,
  REROLL_COST,
  rerollBlocker,
  rerollShop,
  sellBlocker,
  sellItem,
  sellPrice,
  START_GOLD,
} from "./run";
import { BACKPACK_SIZE, itemIdsOf, mulberry32, rollShop, SHOP_SIZE } from "./shop";
import type { RunState } from "./types";

/** A run with fixed shop offers, gold and backpack, so tests don't depend on the seed. */
function runWith(overrides: Partial<RunState> = {}): RunState {
  return { ...newRun(1), shop: ["chipped-dagger", "pot-lid", "oak-buckler", "iron-cleaver"], gold: 20, ...overrides };
}

const filled = (n: number, itemId = "pot-lid") =>
  Array.from({ length: BACKPACK_SIZE }, (_, i) => (i < n ? { uid: `item-${i + 1}`, itemId } : null));

describe("sellPrice", () => {
  it("is half the price, rounded down", () => {
    expect(sellPrice("chipped-dagger")).toBe(1); // price 2
    expect(sellPrice("oak-buckler")).toBe(1); // price 3 → 1.5 → 1
    expect(sellPrice("hunting-bow")).toBe(2); // price 4
    expect(sellPrice("iron-cleaver")).toBe(2); // price 5 → 2.5 → 2
  });
});

describe("buyItem", () => {
  it("pays the price, fills the first free slot and marks the offer sold", () => {
    const run = runWith({ backpack: filled(2) });
    const next = buyItem(run, 0);
    expect(next.gold).toBe(20 - getItem("chipped-dagger").price);
    expect(next.backpack[2]?.itemId).toBe("chipped-dagger");
    expect(next.shop[0]).toBeNull();
    expect(next.shop.slice(1)).toEqual(run.shop.slice(1));
  });

  it("allows spending exactly all gold and never goes negative", () => {
    const next = buyItem(runWith({ gold: 5 }), 3); // iron cleaver costs 5
    expect(next.gold).toBe(0);
    expect(next.backpack.some((slot) => slot?.itemId === "iron-cleaver")).toBe(true);
  });

  it("refuses when there is not enough gold and changes nothing", () => {
    const run = runWith({ gold: 4 });
    expect(buyBlocker(run, 3)).toBe("Not enough gold");
    expect(buyItem(run, 3)).toBe(run);
  });

  it("refuses an offer that was already sold", () => {
    const run = runWith({ shop: [null, "pot-lid", "oak-buckler", "iron-cleaver"] });
    expect(buyBlocker(run, 0)).toBe("Already sold");
    expect(buyItem(run, 0)).toBe(run);
  });

  it("refuses when the backpack is full: gold is kept and no item is lost", () => {
    const run = runWith({ backpack: filled(BACKPACK_SIZE) });
    expect(buyBlocker(run, 0)).toBe("Backpack full");
    const next = buyItem(run, 0);
    expect(next).toBe(run);
    expect(next.gold).toBe(20);
    expect(Object.keys(next.backpack)).toHaveLength(BACKPACK_SIZE);
  });

  it("refuses an offer index that does not exist", () => {
    const run = runWith();
    expect(buyItem(run, 99)).toBe(run);
    expect(buyItem(run, -1)).toBe(run);
  });

  it("does not mutate the state it was given", () => {
    const run = runWith();
    const snapshot = structuredClone(run);
    buyItem(run, 0);
    expect(run).toEqual(snapshot);
  });

  it("gives every bought item its own uid", () => {
    let run = runWith({ gold: 20 });
    run = buyItem(buyItem(run, 0), 1);
    const uids = run.backpack.flatMap((slot) => (slot ? [slot.uid] : []));
    expect(new Set(uids).size).toBe(2);
  });
});

describe("sellItem", () => {
  it("removes the item and pays half its price, rounded down", () => {
    const run = runWith({ gold: 3, backpack: filled(0).map((_, i) => (i === 1 ? { uid: "item-9", itemId: "iron-cleaver" } : null)) });
    const next = sellItem(run, 1);
    expect(next.gold).toBe(3 + 2);
    expect(next.backpack[1]).toBeNull();
    expect(itemIdsOf(next.backpack)).toEqual([]);
  });

  it("leaves all other slots untouched", () => {
    const run = runWith({ backpack: filled(3) });
    const next = sellItem(run, 1);
    expect(next.backpack[0]).toBe(run.backpack[0]);
    expect(next.backpack[2]).toBe(run.backpack[2]);
    expect(itemIdsOf(next.backpack)).toHaveLength(2);
  });

  it("refuses an empty or non-existent slot and changes nothing", () => {
    const run = runWith({ backpack: filled(1) });
    for (const slot of [1, 5, 6, -1]) {
      expect(sellBlocker(run, slot)).toBe("Nothing to sell here");
      expect(sellItem(run, slot)).toBe(run);
    }
  });

  it("frees a slot so a full backpack can buy again", () => {
    const full = runWith({ backpack: filled(BACKPACK_SIZE) });
    expect(buyBlocker(full, 0)).toBe("Backpack full");
    const freed = sellItem(full, 4);
    expect(buyBlocker(freed, 0)).toBeNull();
    expect(buyItem(freed, 0).backpack[4]?.itemId).toBe("chipped-dagger");
  });

  it("does not mutate the state it was given", () => {
    const run = runWith({ backpack: filled(2) });
    const snapshot = structuredClone(run);
    sellItem(run, 0);
    expect(run).toEqual(snapshot);
  });
});

describe("rerollShop", () => {
  it("costs REROLL_COST and replaces every offer, sold ones included", () => {
    const run = runWith({ shop: [null, null, "pot-lid", null], gold: 3 });
    const next = rerollShop(run);
    expect(REROLL_COST).toBe(1);
    expect(next.gold).toBe(2);
    expect(next.shop).toHaveLength(SHOP_SIZE);
    expect(next.shop.every((offer) => offer !== null)).toBe(true);
    expect(next.seed).not.toBe(run.seed);
  });

  it("is deterministic: the same seed gives the same offers and the same next seed", () => {
    const a = rerollShop(runWith({ seed: 123 }));
    const b = rerollShop(runWith({ seed: 123 }));
    expect(a.shop).toEqual(b.shop);
    expect(a.seed).toBe(b.seed);
    expect(a.shop).toEqual(rollShop(123).offers);
  });

  it("can be used with exactly 1 gold and is blocked at 0 gold", () => {
    expect(rerollShop(runWith({ gold: 1 })).gold).toBe(0);
    const broke = runWith({ gold: 0 });
    expect(rerollBlocker(broke)).toBe("Not enough gold");
    expect(rerollShop(broke)).toBe(broke);
  });

  it("does not touch the backpack", () => {
    const run = runWith({ backpack: filled(3) });
    expect(rerollShop(run).backpack).toBe(run.backpack);
  });
});

describe("economy invariants", () => {
  it("holds over many random actions: gold never negative, no item lost or duplicated", () => {
    for (const seed of [1, 7, 42, 2026]) {
      const rng = mulberry32(seed);
      let run = newRun(seed);
      let expectedItems = 0;
      const seen = new Set<string>();

      for (let step = 0; step < 300; step++) {
        const before = run;
        const action = Math.floor(rng() * 3);
        if (action === 0) run = buyItem(run, Math.floor(rng() * SHOP_SIZE));
        else if (action === 1) run = sellItem(run, Math.floor(rng() * BACKPACK_SIZE));
        else run = rerollShop(run);

        // Every action either completed fully or changed nothing at all.
        const changed = run !== before;
        const goldDelta = run.gold - before.gold;
        const countDelta = itemIdsOf(run.backpack).length - itemIdsOf(before.backpack).length;
        if (!changed) expect(run).toBe(before);
        if (action === 0 && changed) {
          expect(countDelta).toBe(1);
          expect(goldDelta).toBeLessThan(0);
          expectedItems += 1;
        }
        if (action === 1 && changed) {
          expect(countDelta).toBe(-1);
          expect(goldDelta).toBeGreaterThanOrEqual(0);
          expectedItems -= 1;
        }
        if (action === 2 && changed) {
          expect(countDelta).toBe(0);
          expect(goldDelta).toBe(-REROLL_COST);
        }

        expect(run.gold).toBeGreaterThanOrEqual(0);
        expect(run.backpack).toHaveLength(BACKPACK_SIZE);
        expect(itemIdsOf(run.backpack)).toHaveLength(expectedItems);
        const uids = run.backpack.flatMap((slot) => (slot ? [slot.uid] : []));
        expect(new Set(uids).size).toBe(uids.length);
        uids.forEach((uid) => seen.add(uid));
      }
      expect(run.gold).toBeLessThanOrEqual(START_GOLD + 300 * 2);
    }
  });
});
