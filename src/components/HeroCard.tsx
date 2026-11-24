import { formatRate, summarizeBuild } from "../game/build";
import { TICK_SECONDS } from "../game/battle";
import { describeEffects, getItem } from "../game/items";
import { describeBonus, SET_MIN_ITEMS, setProgress } from "../game/sets";
import { itemIdsOf } from "../game/shop";
import { BUILD_HELP } from "../rules";
import type { RunState } from "../game/types";
import { SetBadge } from "./SetBadge";

/** Hover hint styling for values that have an explanatory tooltip (same as on the item cards). */
const HELP = "cursor-help underline decoration-dotted decoration-muted/60 underline-offset-2";

/** The hero and what their backpack brings into a battle. */
export function HeroCard({ run }: { run: RunState }) {
  const build = summarizeBuild(run.backpack);
  const sets = setProgress(itemIdsOf(run.backpack));
  const items = run.backpack.flatMap((slot) => (slot ? [getItem(slot.itemId)] : []));

  const stats = [
    { label: "HP", value: `❤️ ${build.hp}`, help: BUILD_HELP.hp },
    { label: "Items", value: `🎒 ${build.itemCount} / ${build.capacity}`, help: BUILD_HELP.items },
    { label: "Damage / s", value: `⚔️ ${formatRate(build.damagePerSecond)}`, help: BUILD_HELP.damage, className: "text-life" },
    { label: "Block / s", value: `🛡️ ${formatRate(build.blockPerSecond)}`, help: BUILD_HELP.block },
  ];

  return (
    <section aria-label="Your hero" className="flex flex-col gap-3 rounded-lg border-2 border-gold/60 bg-panel p-4">
      <h2 className="flex items-center gap-3 font-display text-xl font-bold">
        <span className="text-4xl" aria-hidden>
          🧝
        </span>
        <span>
          Hero
          <span className="block text-sm font-normal text-muted">Your build for this round</span>
        </span>
      </h2>

      <dl className="grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border border-panel-edge bg-ink/40 px-3 py-2">
            <dt title={stat.help} className={`text-xs uppercase tracking-wider text-muted ${HELP}`}>
              {stat.label}
            </dt>
            <dd className={`font-display text-lg font-bold ${stat.className ?? ""}`}>{stat.value}</dd>
          </div>
        ))}
      </dl>

      {sets.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs uppercase tracking-wider text-muted">Set bonuses</h3>
          <ul className="flex flex-col gap-1" aria-label="Set bonuses">
            {sets.map(({ set, count, active }) => (
              <li key={set.id} className="flex items-center gap-2 rounded-md bg-ink/40 px-2 py-1 text-sm">
                <SetBadge setId={set.id} active={active} />
                <span className="font-mono text-xs text-muted">
                  {count} / {SET_MIN_ITEMS}
                </span>
                <span className={`min-w-0 flex-1 text-xs ${active ? "text-gold" : "text-muted"}`}>
                  {active ? `Active: ${describeBonus(set)}` : `Needs ${SET_MIN_ITEMS - count} more to activate`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-1 text-xs uppercase tracking-wider text-muted">Loadout</h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted">No items yet. Your hero fights bare-handed.</p>
        ) : (
          <ul className="flex flex-col gap-1" aria-label="Items in your backpack">
            {items.map((item, index) => (
              <li key={index} className="flex items-center gap-2 rounded-md bg-ink/40 px-2 py-1 text-sm">
                <span className="text-xl leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">{item.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {describeEffects(item.effects)
                    .map(({ label }) => label)
                    .join(" · ")}{" "}
                  · ⏱️ {item.cooldown * TICK_SECONDS}s
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
