import { shopLock, updateRun } from "../game";
import { buyItem, rerollShop, sellItem } from "../run";
import { useActiveGame } from "../state/GameContext";
import { Backpack } from "./Backpack";
import { HeroCard } from "./HeroCard";
import { Shop } from "./Shop";

/**
 * The shop on the left and the inventory on the right. Every action goes
 * through `updateRun`, so it only takes effect while shopping. With
 * `inventoryOnly` the read-only backpack is shown next to the hero card.
 */
export function ShopArea({ inventoryOnly = false }: { inventoryOnly?: boolean }) {
  const { game, update } = useActiveGame();
  const lock = shopLock(game);

  // Nothing can be bought or sold here: show the locked-in backpack and what it adds up to.
  if (inventoryOnly) {
    return (
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Backpack run={game.run} />
        <HeroCard run={game.run} />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <Shop
        run={game.run}
        lock={lock}
        onBuy={(offerIndex) => update((current) => updateRun(current, (run) => buyItem(run, offerIndex)))}
        onReroll={() => update((current) => updateRun(current, rerollShop))}
      />
      <Backpack run={game.run} lock={lock} onSell={(slot) => update((current) => updateRun(current, (run) => sellItem(run, slot)))} />
    </div>
  );
}
