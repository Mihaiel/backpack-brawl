import type { HallOfFameEntry, Opponent, RunSubmission } from "./game/types";

/** Reads a JSON answer; throws with the server's error text (or `fallback` and the status) on failure. */
async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `${fallback} (${response.status})`);
  }
  return response.json() as Promise<T>;
}

/** Asks the API for this round's opponent; throws with the server's error text on failure. */
export async function fetchOpponent(round: number): Promise<Opponent> {
  const response = await fetch(`/api/opponents?round=${encodeURIComponent(round)}`);
  return readJson<Opponent>(response, "Opponent search failed");
}

// ====== B7 - Fetching hall of Fame and submitting a Run ======

/** B7: the best runs, best first. */
export async function fetchHallOfFame(): Promise<HallOfFameEntry[]> {
  const response = await fetch("/api/hall-of-fame");
  return readJson<HallOfFameEntry[]>(response, "Loading the hall of fame failed");
}

/** B7: sends a finished run; answers with the stored entry and its rank. */
export async function submitRun(run: RunSubmission): Promise<HallOfFameEntry> {
  const response = await fetch("/api/hall-of-fame", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(run),
  });
  return readJson<HallOfFameEntry>(response, "Submitting the run failed");
}

// ================================================================