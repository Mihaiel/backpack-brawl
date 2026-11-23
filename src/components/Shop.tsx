import { getItem } from "../items";
import { buyBlocker, REROLL_COST, rerollBlocker } from "../run";
import type { RunState } from "../types";
import { ItemCard } from "./ItemCard";

interface ShopProps {
  run: RunState;
  /** Why shopping is locked right now (e.g. a search is running), or `null`. */
  lock: string | null;
  onBuy: (offerIndex: number) => void;
  onReroll: () => void;
}

export function Shop({ run, lock, onBuy, onReroll }: ShopProps) {
  const rerollReason = lock ?? rerollBlocker(run);

  return (
    <section className={`rounded-lg border border-panel-edge bg-panel p-4 ${lock ? "opacity-60" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">🏪 Shop</h2>
        <button
          type="button"
          onClick={onReroll}
          disabled={rerollReason !== null}
          title={rerollReason ?? `Replace all offers with new ones for ${REROLL_COST} 🪙`}
          className="rounded-md border border-gold/60 px-3 py-1 text-sm font-bold text-gold hover:bg-gold/10 disabled:border-panel-edge disabled:text-muted disabled:hover:bg-transparent"
        >
          {rerollReason ?? `🎲 Reroll for ${REROLL_COST} 🪙`}
        </button>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {run.shop.map((itemId, index) => {
          if (!itemId) {
            return (
              <li key={index} className="grid min-h-32 place-items-center rounded-lg border-2 border-dashed border-panel-edge text-sm text-muted">
                Sold
              </li>
            );
          }
          const item = getItem(itemId);
          const reason = lock ?? buyBlocker(run, index);
          return (
            <li key={index}>
              <ItemCard item={item}>
                <button
                  type="button"
                  onClick={() => onBuy(index)}
                  disabled={reason !== null}
                  title={reason ?? undefined}
                  className="mt-auto rounded-md bg-gold px-3 py-1.5 font-bold text-ink hover:brightness-110 disabled:bg-panel-edge disabled:text-muted"
                >
                  {reason ?? `Buy for ${item.price} 🪙`}
                </button>
              </ItemCard>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
