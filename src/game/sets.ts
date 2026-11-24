import { describeEffects, getItem } from "./items";
import type { FighterItem, ItemEffects, SetId } from "./types";

/** B4: a set bonus is active while at least this many items of the set are in the backpack. */
export const SET_MIN_ITEMS = 2;

export interface SetDef {
  id: SetId;
  name: string;
  icon: string;
  /** Extra effects that every item of the set gets while the set is active. */
  bonus: ItemEffects;
}

export const SETS: SetDef[] = [
  { id: "fire", name: "Fire", icon: "🔥", bonus: { burn: 1 } },
  { id: "guard", name: "Guard", icon: "🛡️", bonus: { block: 2 } },
];

export function getSet(id: SetId): SetDef {
  const set = SETS.find((s) => s.id === id);
  if (!set) throw new Error(`Unknown set: ${id}`);
  return set;
}

/** Text for the bonus, e.g. "every Fire item gets 🔥 +1 burn". */
export const describeBonus = (set: SetDef) =>
  `every ${set.name} item gets ${describeEffects(set.bonus).map(({ label }) => label).join(" and ")}`;

/** Per set: how many of the given items belong to it, and whether the bonus is active. Sets without items are left out. */
export function setProgress(itemIds: string[]): { set: SetDef; count: number; active: boolean }[] {
  return SETS.map((set) => {
    const count = itemIds.filter((id) => getItem(id).set === set.id).length;
    return { set, count, active: count >= SET_MIN_ITEMS };
  }).filter(({ count }) => count > 0);
}

export const activeSetIds = (itemIds: string[]): SetId[] =>
  setProgress(itemIds).filter(({ active }) => active).map(({ set }) => set.id);

/** Adds the bonus of every active set to the effects of that set's items. Other items stay as they are. */
export function applySetBonuses(items: FighterItem[], active: SetId[]): FighterItem[] {
  return items.map((item) => {
    if (!item.set || !active.includes(item.set)) return item;
    const effects: ItemEffects = { ...item.effects };
    for (const [effect, amount] of Object.entries(getSet(item.set).bonus) as [keyof ItemEffects, number][]) {
      effects[effect] = (effects[effect] ?? 0) + amount;
    }
    return { ...item, effects };
  });
}
