import { getItem } from "./items";
import { itemIdsOf, mulberry32 } from "./shop";
import type { Backpack, BattleEvent, BattleResult, Fighter, FighterItem, FighterSnapshot, Opponent, Side } from "./types";

/** Seconds per battle tick. */
export const TICK_SECONDS = 0.5;
/** Battles that last longer are decided by the timeout rule. */
export const MAX_TICKS = 60;
export const HERO_BASE_HP = 40;

// ============== B3: Poison Parameters ==============
export const POISON_MIN_TICKS = 2;
export const POISON_MAX_TICKS = 4;
/** B3: HP a poisoned fighter loses per stack at the end of every tick. */
export const POISON_DAMAGE_PER_STACK = 1;

// ========================================================

// POISON ROLL TICKS, so it chooses a random number between 2-4 ticks after that
// the poison expires
/**
 * Rolls how many ticks a poison application lasts. The roll is deterministic:
 * it depends only on the tick and on who fired, so a battle always plays out
 * the same and the order of the backpack cannot change it.
 */
export function rollPoisonTicks(tick: number, side: Side): number {
  const rng = mulberry32(tick * 2 + (side === "player" ? 0 : 1));
  return POISON_MIN_TICKS + Math.floor(rng() * (POISON_MAX_TICKS - POISON_MIN_TICKS + 1));
}

/** Turns a list of item ids into a fighter with the catalog values of each item. */
export function buildFighter(itemIds: string[], baseHp: number, name = "Fighter"): Fighter {
  const items: FighterItem[] = itemIds.map((id) => {
    const def = getItem(id);
    return { itemId: def.id, name: def.name, icon: def.icon, cooldown: def.cooldown, effects: { ...def.effects } };
  });
  return { name, maxHp: baseHp, items };
}

/** The player's fighter: every backpack item and the hero's base HP. */
export function buildPlayerFighter(backpack: Backpack): Fighter {
  return buildFighter(itemIdsOf(backpack), HERO_BASE_HP, "Hero");
}

export function buildOpponentFighter(opponent: Opponent): Fighter {
  return buildFighter(opponent.items, opponent.hp, opponent.name);
}

interface FighterState {
  fighter: Fighter;
  hp: number;
  block: number;
  /** Ticks each item has charged towards its cooldown. */
  charge: number[];
  /** B3: running poison applications; each one burns for `ticksLeft` more ticks. */
  poison: PoisonEffect[];
}

// POISON EFFECT INTERFACE with stacks and stacksLeft
interface PoisonEffect {
  stacks: number;
  ticksLeft: number;
}

const other = (side: Side): Side => (side === "player" ? "opponent" : "player");

const snapshot = (s: FighterState): FighterSnapshot => ({
  hp: Math.max(0, s.hp),
  maxHp: s.fighter.maxHp,
  block: s.block,
  poison: poisonStacks(s),
});

const poisonStacks = (s: FighterState) => s.poison.reduce((sum, effect) => sum + effect.stacks, 0);

const isDown = (s: FighterState) => s.hp <= 0;

/**
 * Runs a full battle. Pure and deterministic: the same fighters always give
 * the same result.
 *
 * Each tick:
 * 1. Each fighter charges all items by one tick; items whose charge reaches their cooldown fire.
 * 2. Fired items deal damage, add block and add poison (player first, then opponent). Both sides
 *    fire "simultaneously": which items fire is decided before any effect is applied.
 * 3. Heals are applied for both sides, after all damage of this tick.
 * 4. Poison burns: every poisoned fighter loses HP per active stack, ignoring block. Each poison
 *    application then has one tick less to live.
 * After step 4 the battle ends if someone is down; if both are down, the player loses.
 * After `MAX_TICKS` the higher HP percentage wins; a tie is a player loss.
 */
export function simulateBattle(player: Fighter, opponent: Fighter): BattleResult {
  const state: Record<Side, FighterState> = {
    player: initState(player),
    opponent: initState(opponent),
  };
  const frames: BattleResult["frames"] = [
    { tick: 0, player: snapshot(state.player), opponent: snapshot(state.opponent), events: [] },
  ];
  const events: BattleEvent[] = [];

  const knockoutWinner = (): Side | null => {
    if (isDown(state.player)) return "opponent";
    if (isDown(state.opponent)) return "player";
    return null;
  };

  let winner: Side | null = null;
  let tick = 0;
  while (winner === null && tick < MAX_TICKS) {
    tick += 1;
    const tickEvents: BattleEvent[] = [];
    const emit = (event: Omit<BattleEvent, "tick">) => tickEvents.push({ tick, ...event });

    const fired: Record<Side, FighterItem[]> = {
      player: chargeItems(state.player),
      opponent: chargeItems(state.opponent),
    };
    const sides = ["player", "opponent"] as const;
    for (const side of sides) {
      for (const item of fired[side]) resolveItem(item, state[side], state[other(side)], side, tick, emit);
    }
    for (const side of sides) {
      for (const item of fired[side]) healItem(item, state[side], side, emit);
    }
    for (const side of sides) burnPoison(state[side], side, emit);
    winner = knockoutWinner();

    frames.push({ tick, player: snapshot(state.player), opponent: snapshot(state.opponent), events: tickEvents });
    events.push(...tickEvents);
  }

  if (winner !== null) return { winner, reason: "knockout", frames, events };
  return { winner: timeoutWinner(state.player, state.opponent), reason: "timeout", frames, events };
}

function initState(fighter: Fighter): FighterState {
  return { fighter, hp: fighter.maxHp, block: 0, charge: fighter.items.map(() => 0), poison: [] };
}

/** Advances one tick of cooldowns and returns the items that fire this tick. */
function chargeItems(s: FighterState): FighterItem[] {
  const fired: FighterItem[] = [];
  s.fighter.items.forEach((item, i) => {
    s.charge[i] += 1;
    if (s.charge[i] >= item.cooldown) {
      s.charge[i] = 0;
      fired.push(item);
    }
  });
  return fired;
}

function resolveItem(
  item: FighterItem,
  self: FighterState,
  enemy: FighterState,
  side: Side,
  tick: number,
  emit: (event: Omit<BattleEvent, "tick">) => void,
) {
  const { damage, block, poison } = item.effects;
  const base = { source: side, itemId: item.itemId };
  const enemySide = other(side);

  if (damage) {
    const absorbed = Math.min(enemy.block, damage);
    enemy.block -= absorbed;
    enemy.hp -= damage - absorbed;
    const note = absorbed > 0 ? ` (${absorbed} blocked)` : "";
    emit({ ...base, target: enemySide, kind: "damage", amount: damage, message: `${item.name} hits ${enemy.fighter.name} for ${damage}${note}` });
  }
  if (block) {
    self.block += block;
    emit({ ...base, target: side, kind: "block", amount: block, message: `${item.name} grants ${self.fighter.name} ${block} block` });
  }
  if (poison) {
    const ticks = rollPoisonTicks(tick, side);
    enemy.poison.push({ stacks: poison, ticksLeft: ticks });
    emit({ ...base, target: enemySide, kind: "poison", amount: poison, message: `${item.name} poisons ${enemy.fighter.name}: +${poison} poison for ${ticks} ticks` });
  }
}

/** B3: heals the item's owner, never above max HP. */
function healItem(item: FighterItem, self: FighterState, side: Side, emit: (event: Omit<BattleEvent, "tick">) => void) {
  const { heal } = item.effects;
  if (!heal) return;
  const healed = Math.min(heal, self.fighter.maxHp - self.hp);
  self.hp += healed;
  const note = healed < heal ? " (capped at max HP)" : "";
  emit({ source: side, itemId: item.itemId, target: side, kind: "heal", amount: healed, message: `${item.name} heals ${self.fighter.name} for ${healed}${note}` });
}

/** B3: poison hurts for every active stack (block is ignored), then every application ages by one tick. */
function burnPoison(s: FighterState, side: Side, emit: (event: Omit<BattleEvent, "tick">) => void) {
  const stacks = poisonStacks(s);
  if (stacks === 0) return;
  const damage = stacks * POISON_DAMAGE_PER_STACK;
  s.hp -= damage;
  emit({ source: other(side), target: side, kind: "poisonDamage", amount: damage, message: `Poison hurts ${s.fighter.name} for ${damage} (${stacks} ${stacks === 1 ? "stack" : "stacks"})` });
  s.poison = s.poison.map((p) => ({ ...p, ticksLeft: p.ticksLeft - 1 })).filter((p) => p.ticksLeft > 0);
}

function timeoutWinner(player: FighterState, opponent: FighterState): Side {
  const ratio = (s: FighterState) => s.hp / s.fighter.maxHp;
  return ratio(player) > ratio(opponent) ? "player" : "opponent";
}
