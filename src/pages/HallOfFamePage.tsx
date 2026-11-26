import { useEffect, useState } from "react";
import { fetchHallOfFame } from "../api";
import type { HallOfFameEntry } from "../game/types";
import { useGame } from "../state/GameContext";

/** B7: the best runs, loaded from the API. Reachable without a run. */
export function HallOfFamePage() {
  const { game } = useGame();
  const [entries, setEntries] = useState<HallOfFameEntry[] | null>(null); // null = not loaded yet
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // Retry adds 1, which loads the list again

  // Load the list when the page opens, and again after every Retry.
  useEffect(() => {
    fetchHallOfFame()
      .then((list) => setEntries(list))
      .catch(() => setError("Could not load the hall of fame. Is the server running?"));
  }, [attempt]);

  function retry() {
    setError(null);
    setAttempt(attempt + 1);
  }

  // Pick what to show: error, loading, empty or the table.
  let content;
  if (error) {
    content = (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-life">
        <p>⚠️ {error}</p>
        <button type="button" onClick={retry} className="rounded-md border border-panel-edge px-4 py-1.5 text-parchment hover:bg-panel-edge/40">
          Retry
        </button>
      </div>
    );
  } else if (entries === null) {
    content = <p className="animate-pulse text-muted">Loading the hall of fame…</p>;
  } else if (entries.length === 0) {
    content = <p className="text-muted">No runs yet. Finish a run and be the first!</p>;
  } else {
    content = (
      <table className="w-full text-left">
        <thead className="text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="py-1">#</th>
            <th>Name</th>
            <th>Result</th>
            <th className="text-right">Wins</th>
            <th className="text-right">Lives</th>
            <th className="text-right">Rounds</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            // Your own run is highlighted.
            <tr key={entry.runId} className={`border-t border-panel-edge ${entry.runId === game?.runId ? "font-bold text-gold" : ""}`}>
              <td className="py-1.5 font-mono">{entry.rank}</td>
              <td>{entry.name}</td>
              <td>{entry.outcome === "victory" ? "👑 Victory" : "🪦 Defeat"}</td>
              <td className="text-right font-mono">{entry.wins}</td>
              <td className="text-right font-mono">{entry.lives}</td>
              <td className="text-right font-mono">{entry.rounds}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-lg border-2 border-gold bg-panel p-6">
      <header>
        <h2 className="font-display text-3xl font-bold">🏆 Hall of fame</h2>
        <p className="text-sm text-muted">Best runs first: more wins, then fewer rounds.</p>
      </header>
      {content}
    </section>
  );
}
