import { useState } from "react";
import { TICK_SECONDS } from "../game/battle";
import { describeEffects, getItem } from "../game/items";
import { sellBlocker, sellPrice } from "../game/run";
import { BACKPACK_COLS } from "../game/shop";
import type { ItemDef, RunState } from "../game/types";

/** Hover text for a backpack slot: name, effects and cooldown. */
const tooltip = (item: ItemDef) =>
  [item.name, ...describeEffects(item.effects).map(({ label }) => label), `⏱️ every ${item.cooldown * TICK_SECONDS}s`].join("\n");

interface BackpackProps {
  run: RunState;
  /** Why shopping is locked right now (e.g. a search is running), or `null`. */
  lock?: string | null;
  
  //? -> Optional, a function that takes a number and returns nothing
  onSell?: (slotIndex: number) => void;
  // Same here, a function that is optional and takes 2 numbers, from and to. These are the indices of the backpack inventory slots.
  onMove?: (from: number, to: number) => void;
}

export function Backpack({ run, lock = null, onSell, onMove }: BackpackProps) {
  // The selection is plain UI state (not part of the run): the uid keeps it valid while the item moves.
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const canArrange = onMove !== undefined && lock === null;
  const selectedIndex = canArrange ? run.backpack.findIndex((slot) => slot?.uid === selectedUid) : -1;
  const selectedItem = selectedIndex >= 0 ? getItem(run.backpack[selectedIndex]!.itemId) : null;

  function handleSlot(index: number) {
    if (!canArrange) return;
    if (selectedIndex === -1) {
      if (run.backpack[index]) setSelectedUid(run.backpack[index].uid); // select
    } else if (index === selectedIndex) {
      setSelectedUid(null); // cancel
    } else {
      onMove(selectedIndex, index); // move to an empty slot or swap
      setSelectedUid(null);
    }
  }

  let hint = "Hover an item to see its stats. Your backpack is locked in for this round.";
  if (onMove && lock) hint = `Moving and selling are closed: ${lock.toLowerCase()}.`;
  else if (onMove && selectedItem) hint = `${selectedItem.name} selected. Pick a slot to move over, or pick it again to cancel.`;
  else if (onMove) hint = "Hover an item to see its stats.";

  return (
    <section className={`rounded-lg border border-panel-edge bg-panel p-4 ${lock ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">🎒 Inventory</h2>
        {selectedItem && (
          <button
            type="button"
            onClick={() => setSelectedUid(null)}
            className="rounded-md border border-gold/60 px-3 py-1 text-sm font-bold text-gold hover:bg-gold/10"
          >
            Cancel
          </button>
        )}
      </div>
      <p aria-live="polite" className="mb-3 text-sm text-muted">
        {hint}
      </p>
      <ul className="grid gap-2" style={{ gridTemplateColumns: `repeat(${BACKPACK_COLS}, minmax(0, 1fr))` }}>
        {run.backpack.map((slot, index) => {
          const item = slot ? getItem(slot.itemId) : null;
          const selected = index === selectedIndex;
          const target = selectedItem !== null && !selected; // every other slot is a possible move
          const sellReason = lock ?? sellBlocker(run, index);
          return (
            <li
              key={slot?.uid ?? `empty-${index}`}
              title={item ? tooltip(item) : undefined}
              className={[
                "flex min-h-32 flex-col rounded-md border-2",
                selected ? "border-gold bg-gold/10 ring-2 ring-gold" : "",
                target ? "border-dashed border-gold/70" : "",
                !selected && !target ? (item ? "border-gold/40 bg-ink/40" : "border-dashed border-panel-edge") : "",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => handleSlot(index)}
                disabled={!canArrange || (!item && !target)}
                aria-pressed={item ? selected : undefined}
                aria-label={
                  item ? `${item.name}${selected ? ", selected" : target ? ", swap here" : ""}` : target ? `Empty slot ${index + 1}, move here` : `Empty slot ${index + 1}`
                }
                className={`flex flex-1 flex-col items-center justify-center gap-1 p-2 enabled:hover:bg-gold/10 ${item ? "cursor-pointer disabled:cursor-help" : ""}`}
              >
                {item && (
                  <>
                    <span className="text-3xl leading-none sm:text-4xl" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="text-center text-xs leading-tight">{item.name}</span>
                  </>
                )}
                <span className="text-xs font-bold text-gold">{selected ? "Selected" : target ? (item ? "⇄ Swap" : "Move here") : ""}</span>
              </button>
              {item && onSell && (
                <button
                  type="button"
                  onClick={() => onSell(index)}
                  disabled={sellReason !== null}
                  title={sellReason ?? undefined}
                  className="m-2 mt-0 rounded-md bg-gold px-2 py-1 text-xs font-bold text-ink hover:brightness-110 disabled:bg-panel-edge disabled:text-muted"
                >
                  {sellReason ?? `Sell for ${sellPrice(item.id)} 🪙`}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
