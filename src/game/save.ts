import { buildFighter, buildOpponentFighter, HERO_BASE_HP, simulateBattle } from "./battle";
import { skipReplay } from "./game";
import { CATALOG, getItem } from "./items";
import { GOLD_PER_ROUND, runOutcome, START_GOLD, START_LIVES, WINS_TO_VICTORY } from "./run";
import { BACKPACK_SIZE, SHOP_SIZE } from "./shop";
import type { GameState, Opponent, Phase, RunState } from "./types";

/**
 * B6: saving and resuming a run. Pure: the browser storage itself is touched
 *
 * What is saved: the whole run, the phase, and for a battle only its inputs
 * (opponent, hero items) and the replay position. The frames are not saved,
 * they are recomputed, because `simulateBattle` is deterministic.
 *
 * Policy for a refresh:
 * - searching: the search is cancelled, back in the shop (nothing was decided yet).
 * - battle replay still running: the replay jumps to the end and the result counts now.
 * - battle replay already done: stays as it was (the result is already in the run).
 */

const PHASES: Phase[] = ["shop", "searching", "battle", "finished"];

interface SavedBattle {
  opponent: Opponent;
  heroItems: string[];
  frame: number;
}

interface SavedGame {
  phase: Phase;
  run: RunState;
  battle: SavedBattle | null;
}

// We serialise the current gameState and turn in into a JSON object for storage.
export function serializeGame(game: GameState): string {
  const battle: SavedBattle | null = game.battle && {
    opponent: game.battle.opponent,
    heroItems: game.battle.player.items.map((item) => item.itemId),
    frame: game.battle.frame,
  };
  const saved: SavedGame = { phase: game.phase, run: game.run, battle };
  return JSON.stringify(saved);
}

// It parses the JSON stored object and Restores it (the restore function is underneath)
// AND returns the GameState as an object
export function loadSavedGame(json: string | null): GameState | null {
  if (json === null) return null;
  try {
    const saved: unknown = JSON.parse(json);
    return isSavedGame(saved) ? restore(saved) : null;
  } catch {
    return null; // not JSON, or the data made the rules throw
  }
}

// Rebuilds a GameState. The shop and searching phases become a plain shop. 
// The finished phase stays finished. For a battle, it rebuilds the hero and the enemy fighter, runs simulateBattle 
function restore({ phase, run, battle }: SavedGame): GameState | null {
  const over = runOutcome(run) !== null;

  if (phase === "finished") {
    if (!over) return null; // "finished" but the run is not over: impossible
    return { phase, run, battle: null, searchId: null, error: null };
  }

  if (phase === "shop" || phase === "searching") {
    if (over) return null; // a run that is over cannot be in the shop
    // A search that was running is cancelled: both phases come back as "shop".
    return { phase: "shop", run, battle: null, searchId: null, error: null };
  }

  // Only the phase "battle" is left.

  // If there was no battle just return to the last phase state
  if (!battle) return null;

  // Here we finish simualting the battle if the user quit during the battle
  const player = buildFighter(battle.heroItems, HERO_BASE_HP, "Hero");
  const enemy = buildOpponentFighter(battle.opponent);
  const result = simulateBattle(player, enemy);
  const frame = Math.min(battle.frame, result.frames.length - 1);

  // A replay that was still running jumps to its end and applies the result (once: a finished replay changes nothing).
  return skipReplay({ phase, run, battle: { opponent: battle.opponent, player, enemy, result, frame }, searchId: null, error: null });
}







// ---------- checks: anything that is not a possible game is refused ----------

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isInt = (value: unknown, min: number, max = Infinity): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const isItemId = (value: unknown): value is string => typeof value === "string" && CATALOG.some((item) => item.id === value);
const isItemList = (value: unknown): value is string[] => Array.isArray(value) && value.length <= BACKPACK_SIZE && value.every(isItemId);

function isSavedGame(saved: unknown): saved is SavedGame {
  if (!isRecord(saved)) return false;
  if (!PHASES.includes(saved.phase as Phase) || !isPossibleRun(saved.run)) return false;
  return saved.battle === null || isSavedBattle(saved.battle);
}

function isSavedBattle(battle: unknown): battle is SavedBattle {
  if (!isRecord(battle) || !isInt(battle.frame, 0) || !isItemList(battle.heroItems)) return false;
  const opponent = battle.opponent;
  return (
    isRecord(opponent) &&
    typeof opponent.id === "string" &&
    typeof opponent.name === "string" &&
    typeof opponent.icon === "string" &&
    isInt(opponent.hp, 1) &&
    isInt(opponent.round, 1) &&
    isItemList(opponent.items)
  );
}

/** Shape and value ranges, plus what a real run can and cannot look like. */
function isPossibleRun(run: unknown): run is RunState {
  if (!isRecord(run)) return false;
  const { round, gold, lives, wins, seed, shop, backpack, nextUid } = run;
  if (!isInt(round, 1) || !isInt(gold, 0) || !isInt(lives, 0, START_LIVES) || !isInt(wins, 0, WINS_TO_VICTORY)) return false;
  if (!isInt(seed, 0) || !isInt(nextUid, 1)) return false;
  if (!Array.isArray(shop) || shop.length !== SHOP_SIZE || !shop.every((offer) => offer === null || isItemId(offer))) return false;
  if (!Array.isArray(backpack) || backpack.length !== BACKPACK_SIZE) return false;

  const owned: string[] = [];
  const uids = new Set<string>();
  for (const slot of backpack) {
    if (slot === null) continue;
    if (!isRecord(slot) || typeof slot.uid !== "string" || !isItemId(slot.itemId)) return false;
    uids.add(slot.uid);
    owned.push(slot.itemId);
  }
  if (uids.size !== owned.length) return false; // two items share one uid

  // Every battle is one round; the last battle of a finished run does not start another round.
  const over = wins >= WINS_TO_VICTORY || lives <= 0;
  if (round !== wins + (START_LIVES - lives) + (over ? 0 : 1)) return false;

  // Gold and items can never be worth more than all the gold the run has earned so far.
  const worth = owned.reduce((sum, itemId) => sum + getItem(itemId).price, gold);
  return worth <= START_GOLD + GOLD_PER_ROUND * (round - 1);
}
