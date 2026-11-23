import { TICK_SECONDS } from "../battle";
import { describeEffects, getItem } from "../items";
import { sellBlocker, sellPrice } from "../run";
import { BACKPACK_COLS } from "../shop";
import type { ItemDef, RunState } from "../types";

/** Hover text for a backpack slot: name, effects and cooldown. */
const tooltip = (item: ItemDef) =>
  [item.name, ...describeEffects(item.effects).map(({ label }) => label), `⏱️ every ${item.cooldown * TICK_SECONDS}s`].join("\n");

interface BackpackProps {
  run: RunState;
  /** Why selling is locked right now (e.g. a search is running), or `null`. */
  lock?: string | null;
  /** Without this handler the backpack is read-only (no sell buttons). */
  onSell?: (slotIndex: number) => void;
}

export function Backpack({ run, lock = null, onSell }: BackpackProps) {
  return (
    <section className={`rounded-lg border border-panel-edge bg-panel p-4 ${lock ? "opacity-60" : ""}`}>
      <h2 className="font-display text-xl font-bold">🎒 Inventory</h2>
      <p className="mb-3 text-sm text-muted">
        {onSell ? "Hover an item to see its stats. Selling pays half the price, rounded down." : "Hover an item to see its stats. Your backpack is locked in for this round."}
      </p>
      <ul className="grid gap-2" style={{ gridTemplateColumns: `repeat(${BACKPACK_COLS}, minmax(0, 1fr))` }}>
        {run.backpack.map((slot, index) => {
          const item = slot ? getItem(slot.itemId) : null;
          const reason = lock ?? sellBlocker(run, index);
          return (
            <li
              key={slot?.uid ?? `empty-${index}`}
              aria-label={item ? item.name : `Empty slot ${index + 1}`}
              className={[
                "flex min-h-32 flex-col items-center justify-center gap-1 rounded-md border-2 p-2",
                item ? "border-gold/40 bg-ink/40" : "border-dashed border-panel-edge",
              ].join(" ")}
            >
              {item && (
                <>
                  <div title={tooltip(item)} className="flex cursor-help flex-col items-center gap-1">
                    <span className="text-3xl leading-none sm:text-4xl" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="text-center text-xs leading-tight">{item.name}</span>
                  </div>
                  {onSell && (
                    <button
                      type="button"
                      onClick={() => onSell(index)}
                      disabled={reason !== null}
                      title={reason ?? undefined}
                      className="mt-auto w-full rounded-md bg-gold px-2 py-1 text-xs font-bold text-ink hover:brightness-110 disabled:bg-panel-edge disabled:text-muted"
                    >
                      {reason ?? `Sell for ${sellPrice(item.id)} 🪙`}
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
