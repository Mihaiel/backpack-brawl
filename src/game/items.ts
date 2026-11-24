import type { ItemDef, ItemEffects } from "./types";

export const CATALOG: ItemDef[] = [
  { id: "chipped-dagger", name: "Chipped Dagger", icon: "🗡️", price: 2, cooldown: 4, effects: { damage: 3 } },
  { id: "hunting-bow", name: "Hunting Bow", icon: "🏹", price: 4, cooldown: 4, effects: { damage: 5 } },
  { id: "iron-cleaver", name: "Iron Cleaver", icon: "🪓", price: 5, cooldown: 8, effects: { damage: 12 } },
  { id: "oak-buckler", name: "Oak Buckler", icon: "🛡️", price: 3, cooldown: 5, effects: { block: 4 }, set: "guard" },
  { id: "pot-lid", name: "Pot Lid", icon: "🍳", price: 2, cooldown: 3, effects: { block: 2 }, set: "guard" },
  { id: "spiked-shield", name: "Spiked Shield", icon: "⚔️", price: 4, cooldown: 6, effects: { damage: 3, block: 3 }, set: "guard" },

  // B3: poison items
  { id: "venom-dart", name: "Venom Dart", icon: "🐍", price: 3, cooldown: 4, effects: { poison: 1 } },
  { id: "toxic-flask", name: "Toxic Flask", icon: "🧪", price: 4, cooldown: 6, effects: { poison: 2 } },
  { id: "spider-fang", name: "Spider Fang", icon: "🕷️", price: 5, cooldown: 8, effects: { poison: 4 } },

  // B3: heal items
  { id: "herbal-salve", name: "Herbal Salve", icon: "🌿", price: 2, cooldown: 5, effects: { heal: 3 } },
  { id: "golden-apple", name: "Golden Apple", icon: "🍎", price: 3, cooldown: 4, effects: { heal: 4 } },
  { id: "life-charm", name: "Life Charm", icon: "💖", price: 5, cooldown: 8, effects: { heal: 10 } },

  // B4: Fire set (the set bonus adds burn, see sets.ts)
  { id: "ember-dagger", name: "Ember Dagger", icon: "🔥", price: 3, cooldown: 4, effects: { damage: 2 }, set: "fire" },
  { id: "cinder-bow", name: "Cinder Bow", icon: "☄️", price: 4, cooldown: 5, effects: { damage: 3 }, set: "fire" },
  { id: "magma-cleaver", name: "Magma Cleaver", icon: "🌋", price: 5, cooldown: 8, effects: { damage: 8 }, set: "fire" },
];

const byId = new Map(CATALOG.map((item) => [item.id, item]));

export function getItem(id: string): ItemDef {
  const item = byId.get(id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

const EFFECT_LABELS: [keyof ItemEffects, (n: number) => string][] = [
  ["damage", (n) => `⚔️ ${n} dmg`],
  ["block", (n) => `🛡️ +${n} block`],
  
  // B3: Heal and poison labels
  ["poison", (n) => `☠️ +${n} poison`],
  ["heal", (n) => `💚 heals ${n}`],
  ["burn", (n) => `🔥 +${n} burn`],
];

/** Short labels for an item's effects, e.g. `[{ effect: "damage", label: "⚔️ 2 dmg" }, …]`. */
export function describeEffects(effects: ItemEffects): { effect: keyof ItemEffects; label: string }[] {
  return EFFECT_LABELS.flatMap(([effect, label]) => (effects[effect] ? [{ effect, label: label(effects[effect]) }] : []));
}
