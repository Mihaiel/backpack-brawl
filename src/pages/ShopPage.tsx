import { fetchOpponent } from "../api";
import { FightBar } from "../components/FightBar";
import { RulesPanel } from "../components/RulesPanel";
import { RunHeader } from "../components/RunHeader";
import { ShopArea } from "../components/ShopArea";
import { fightBlocker, searchFailed, shopPageOffersShop, startBattle, startSearch } from "../game/game";
import { useActiveGame } from "../state/GameContext";

export function ShopPage() {
  const { game, update } = useActiveGame();
  const { run, phase } = game;

  // Once the opponent is found the phase becomes "battle" and RequireRoute redirects to the battle page.
  // Every time we press "Find Opponent" this would generate 
  async function handleFindOpponent() {
    // If finding a game is blocked for some reason
    if (fightBlocker(game) !== null) return;

    // We genearte a unique ID for that search and store it inside the gamestate, so GameState.searchId
    const id = crypto.randomUUID(); // B5: only the answer to this search may start the battle
    update((current) => startSearch(current, id));
    try {
      const opponent = await fetchOpponent(run.round);
      update((current) => startBattle(current, opponent, id));
    } catch (error) {
      const message = error instanceof Error ? error. message : "Opponent search failed.";
      update((current) => searchFailed(current, id, message));
    }
  }

  return (
    <>
      <RunHeader run={run} />
      <FightBar phase={phase} blocker={fightBlocker(game)} error={game.error} onFight={handleFindOpponent} />

      {/* Round 1: shop and backpack (locked while searching). Later rounds: shopping already happened after the last battle. */}
      <ShopArea inventoryOnly={!shopPageOffersShop(run)} />
      <RulesPanel open={run.round === 1} />
    </>
  );
}
