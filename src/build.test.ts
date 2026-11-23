import { describe, expect, it } from "vitest";
import { formatRate, summarizeBuild } from "./build";
import { newRun } from "./run";
import { BACKPACK_SIZE } from "./shop";

const backpackOf = (...itemIds: string[]) =>
  Array.from({ length: BACKPACK_SIZE }, (_, i) => (itemIds[i] ? { uid: `item-${i + 1}`, itemId: itemIds[i] } : null));

describe("summarizeBuild", () => {
  it("is all zero for an empty backpack", () => {
    const summary = summarizeBuild(newRun(1).backpack);
    expect(summary).toMatchObject({ itemCount: 0, capacity: BACKPACK_SIZE, damagePerSecond: 0, blockPerSecond: 0, hp: 40 });
  });

  it("converts damage and block into per-second rates using each item's cooldown", () => {
    // Chipped Dagger: 3 dmg every 4 ticks (2 s) → 1.5/s. Pot Lid: 2 block every 3 ticks (1.5 s) → 4/3 per s.
    const summary = summarizeBuild(backpackOf("chipped-dagger", "pot-lid"));
    expect(summary.itemCount).toBe(2);
    expect(summary.damagePerSecond).toBeCloseTo(1.5);
    expect(summary.blockPerSecond).toBeCloseTo(4 / 3);
  });

  it("counts both effects of an item and adds up several items", () => {
    // Spiked Shield: 3 dmg + 3 block every 6 ticks (3 s) → 1/s each.
    const summary = summarizeBuild(backpackOf("spiked-shield", "spiked-shield", "iron-cleaver"));
    expect(summary.damagePerSecond).toBeCloseTo(1 + 1 + 12 / 4); // cleaver: 12 dmg every 8 ticks (4 s)
    expect(summary.blockPerSecond).toBeCloseTo(2);
  });

  it("does not change when the item order changes", () => {
    const a = summarizeBuild(backpackOf("hunting-bow", "oak-buckler"));
    const b = summarizeBuild(backpackOf("oak-buckler", "hunting-bow"));
    expect(a).toEqual(b);
  });
});

describe("formatRate", () => {
  it("rounds to one decimal and drops a trailing .0", () => {
    expect(formatRate(3)).toBe("3");
    expect(formatRate(4 / 3)).toBe("1.3");
    expect(formatRate(0)).toBe("0");
  });
});
