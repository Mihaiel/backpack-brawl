import { getSet } from "../game/sets";
import type { SetId } from "../game/types";
import { setHelp } from "../rules";

interface SetBadgeProps {
  setId: SetId;
  /** `true` highlights the badge (bonus is on), `false` greys it out, `undefined` is neutral (e.g. in the shop). */
  active?: boolean;
}

/** Small label that shows which set an item belongs to; the tooltip explains the bonus. */
export function SetBadge({ setId, active }: SetBadgeProps) {
  const set = getSet(setId);
  const colour = active === undefined ? "border-gold/50 text-gold" : active ? "border-gold bg-gold/20 text-gold" : "border-panel-edge text-muted";
  return (
    <span title={setHelp(set)} className={`inline-flex cursor-help items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${colour}`}>
      <span aria-hidden>{set.icon}</span>
      {set.name}
    </span>
  );
}
