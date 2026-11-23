import { HERO_BASE_HP, TICK_SECONDS } from "./battle";
import { getItem } from "./items";
import { BACKPACK_SIZE, itemIdsOf } from "./shop";
import type { Backpack } from "./types";

export interface BuildSummary {
  /** The hero's HP when a battle starts. */
  hp: number;
  itemCount: number;
  /** Backpack slots in total. */
  capacity: number;
  /** Damage your items deal per second, as if nothing blocked it. */
  damagePerSecond: number;
  /** Block your items grant per second. */
  blockPerSecond: number;
}

/** What the hero's build brings into a battle, from the items in the backpack. Pure and cheap. */
export function summarizeBuild(backpack: Backpack): BuildSummary {
  const items = itemIdsOf(backpack).map(getItem);
  const perSecond = (amount: number | undefined, cooldown: number) => (amount ?? 0) / (cooldown * TICK_SECONDS);
  return {
    hp: HERO_BASE_HP,
    itemCount: items.length,
    capacity: BACKPACK_SIZE,
    damagePerSecond: items.reduce((sum, item) => sum + perSecond(item.effects.damage, item.cooldown), 0),
    blockPerSecond: items.reduce((sum, item) => sum + perSecond(item.effects.block, item.cooldown), 0),
  };
}

/** One decimal, no trailing ".0": 3 → "3", 1.333 → "1.3". */
export const formatRate = (value: number) => String(Math.round(value * 10) / 10);
