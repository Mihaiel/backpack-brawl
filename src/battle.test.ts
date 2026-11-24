import { describe, expect, it } from "vitest";
import { buildFighter, POISON_MAX_TICKS, POISON_MIN_TICKS, rollPoisonTicks, simulateBattle } from "./battle";
import { CATALOG } from "./items";
import type { Fighter, FighterItem, ItemEffects } from "./types";

/** A made-up item, so a test only contains the rule it checks. */
const item = (effects: ItemEffects, cooldown = 1): FighterItem => ({
  itemId: "test-item",
  name: "Test Item",
  icon: "🧪",
  cooldown,
  effects,
});
const fighter = (maxHp: number, ...items: FighterItem[]): Fighter => ({ name: "Fighter", maxHp, items });

describe("rollPoisonTicks", () => {
  it("always rolls a duration inside the allowed range", () => {
    for (let tick = 1; tick <= 60; tick++) {
      for (const side of ["player", "opponent"] as const) {
        const ticks = rollPoisonTicks(tick, side);
        expect(ticks).toBeGreaterThanOrEqual(POISON_MIN_TICKS);
        expect(ticks).toBeLessThanOrEqual(POISON_MAX_TICKS);
      }
    }
  });

  it("is deterministic and not always the same number", () => {
    expect(rollPoisonTicks(7, "player")).toBe(rollPoisonTicks(7, "player"));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => rollPoisonTicks(i + 1, "player")));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("poison", () => {
  const dummy = fighter(100); // never does anything
  const poisoner = (stacks: number) => fighter(100, item({ poison: stacks }, 5)); // first fires at tick 5

  it("burns every stack at the end of every tick, for the rolled number of ticks", () => {
    const { frames } = simulateBattle(poisoner(2), dummy);
    const ticks = rollPoisonTicks(5, "player");

    expect(frames[4].opponent.hp).toBe(100); // before the item fired
    expect(frames[5].opponent.poison).toBe(2); // stacks show up right away
    expect(frames[5].opponent.hp).toBe(98); // first burn in the tick it was applied
    expect(frames[4 + ticks].opponent.hp).toBe(100 - 2 * ticks); // one burn per tick
    expect(frames[4 + ticks].opponent.poison).toBe(0); // worn off after the last burn
    expect(frames[9].opponent.hp).toBe(100 - 2 * ticks); // no more damage after that
  });

  it("ignores block", () => {
    const target = fighter(100, item({ block: 5 }));
    const { frames } = simulateBattle(poisoner(1), target);

    expect(frames[5].opponent.block).toBe(25); // 5 ticks of +5 block, none of it used
    expect(frames[5].opponent.hp).toBe(99); // poison got through anyway
  });

  it("stacks up when several items poison in the same tick", () => {
    const { frames } = simulateBattle(fighter(100, item({ poison: 1 }, 5), item({ poison: 2 }, 5)), dummy);

    expect(frames[5].opponent.poison).toBe(3);
    expect(frames[5].opponent.hp).toBe(97);
  });

  it("knocks out the poisoned fighter", () => {
    const result = simulateBattle(poisoner(5), fighter(10));

    expect(result.winner).toBe("player");
    expect(result.reason).toBe("knockout");
  });

  it("logs the poison and its damage", () => {
    const { events } = simulateBattle(poisoner(1), dummy);

    expect(events.find((e) => e.kind === "poison")).toMatchObject({ tick: 5, source: "player", target: "opponent", amount: 1 });
    expect(events.find((e) => e.kind === "poisonDamage")).toMatchObject({ tick: 5, source: "player", target: "opponent", amount: 1 });
  });

  it("makes the hero lose when both fighters fall in the same tick", () => {
    const result = simulateBattle(fighter(2, item({ poison: 2 })), fighter(2, item({ poison: 2 })));

    expect(result.winner).toBe("opponent");
    expect(result.reason).toBe("knockout");
  });
});

describe("heal", () => {
  it("never heals above max HP", () => {
    // Takes 1 damage every tick and heals 5 every third tick.
    const { frames, events } = simulateBattle(fighter(10, item({ heal: 5 }, 3)), fighter(100, item({ damage: 1 })));

    expect(frames[2].player.hp).toBe(8);
    expect(frames[3].player.hp).toBe(10); // 7 + 5 would be 12
    expect(events.find((e) => e.kind === "heal")).toMatchObject({ tick: 3, amount: 3 });
  });

  it("does nothing at full HP", () => {
    const { frames } = simulateBattle(fighter(10, item({ heal: 5 })), fighter(100));

    expect(frames[1].player.hp).toBe(10);
  });

  it("counts against the damage of the same tick", () => {
    // 4 HP, takes 5 and heals 3 in the same tick: the net result is 2 HP, no knockout.
    const { frames } = simulateBattle(fighter(4, item({ heal: 3 })), fighter(100, item({ damage: 5 })));

    expect(frames[1].player.hp).toBe(2);
  });
});

describe("battle with the real catalog", () => {
  const hero = () => buildFighter(["venom-dart", "golden-apple", "chipped-dagger", "oak-buckler", "toxic-flask"], 40, "Hero");
  const enemy = () => buildFighter(["iron-cleaver", "hunting-bow", "herbal-salve", "pot-lid"], 50, "Enemy");
  const hpTimeline = (result: ReturnType<typeof simulateBattle>) => result.frames.map(({ tick, player, opponent }) => ({ tick, player, opponent }));

  it("is deterministic", () => {
    expect(simulateBattle(hero(), enemy())).toEqual(simulateBattle(hero(), enemy()));
  });

  it("does not depend on the order of the backpack", () => {
    const reversed: Fighter = { ...hero(), items: [...hero().items].reverse() };

    expect(hpTimeline(simulateBattle(reversed, enemy()))).toEqual(hpTimeline(simulateBattle(hero(), enemy())));
  });

  it("has at least 3 poison items and 3 heal items", () => {
    expect(CATALOG.filter((i) => i.effects.poison).length).toBeGreaterThanOrEqual(3);
    expect(CATALOG.filter((i) => i.effects.heal).length).toBeGreaterThanOrEqual(3);
  });
});
