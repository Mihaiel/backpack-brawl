import { useState, type SubmitEvent } from "react";
import { Link } from "react-router";
import { submitRun } from "../api";
import { RunHeader } from "../components/RunHeader";
import { RunOver } from "../components/RunOver";
import { markSubmitted, ROUTES, submitBlocker } from "../game/game";
import { runOutcome } from "../game/run";
import { useActiveGame } from "../state/GameContext";

export function ResultPage() {
  const { game, startNewRun, update } = useActiveGame();

  // B7: the name stays in the input after a failed submission, so a retry needs no retyping.
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  const outcome = runOutcome(game.run);
  if (!outcome) return null;

  // B7: disabled while a request is running, so the same run is never sent twice at once.
  const blocker = sending ? "Submitting…" : submitBlocker(game, name);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (blocker !== null) return;
    const runId = game.runId; // the run this request belongs to
    setSending(true);
    setError(null);
    try {
      const entry = await submitRun({ runId, name: name.trim(), wins: game.run.wins, lives: game.run.lives, rounds: game.run.round });
      setRank(entry.rank);
      update((current) => markSubmitted(current, runId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Submitting the run failed");
    } finally {
      setSending(false);
    }
  }

  const box = "mx-auto flex w-full max-w-lg flex-col gap-2 rounded-lg border border-panel-edge bg-panel p-4";

  // Starting a new run moves the phase to "shop", so RequireRoute redirects to the shop.
  return (
    <>
      <RunHeader run={game.run} />
      <RunOver run={game.run} outcome={outcome} onNewRun={startNewRun} />

      {game.submitted ? (
        // B7: already in the hall of fame (also after a refresh, because `submitted` is saved).
        <section role="status" className={`${box} items-center text-center`}>
          <p>{rank === null ? "This run is in the hall of fame." : `Saved! You placed #${rank} in the hall of fame.`}</p>
          <Link to={ROUTES.hallOfFame} className="font-bold text-gold underline hover:brightness-110">
            🏆 View the hall of fame
          </Link>
        </section>
      ) : (
        // B7: name input and submit button.
        <form onSubmit={handleSubmit} className={box}>
          <label htmlFor="hall-name" className="font-bold">
            Enter the hall of fame
          </label>
          <div className="flex gap-2">
            <input
              id="hall-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={20}
              placeholder="Your name"
              disabled={sending}
              className="min-w-0 flex-1 rounded-md border border-panel-edge bg-ink px-3 py-2"
            />
            <button
              type="submit"
              disabled={blocker !== null}
              title={blocker ?? undefined}
              className="shrink-0 rounded-md bg-gold px-4 py-2 font-display font-bold text-ink hover:brightness-110 disabled:bg-panel-edge disabled:text-muted"
            >
              {sending ? "Submitting…" : error ? "Retry" : "Submit"}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-life">
              ⚠️ {error}
            </p>
          )}
        </form>
      )}
    </>
  );
}
