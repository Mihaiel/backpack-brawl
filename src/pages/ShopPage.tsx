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
  async function handleFindOpponent() {
    if (fightBlocker(game) !== null) return;
    update(startSearch);
    try {
      const opponent = await fetchOpponent(run.round);
      update((current) => startBattle(current, opponent));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Opponent search failed.";
      update((current) => searchFailed(current, message));
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
