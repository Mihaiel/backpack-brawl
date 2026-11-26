/**
 * B7: hall of fame rules. Plain functions without Express, so the tests need no server.
 * The entries themselves live in memory in index.js.
 */

// We need these values for the server to check if the run is plausible and we cannot copy them directly from the .tsx file.
// Copied from src/game/run.ts: the server cannot import the TypeScript game rules.
const WINS_TO_VICTORY = 5;
const START_LIVES = 3;

/** How many runs GET /api/hall-of-fame lists. */
export const TOP_COUNT = 10;

const isInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

/** Why a submitted run is refused, or `null` if it is a plausible finished run. */
export function validateRun(body) {
  const { runId, name, wins, lives, rounds } = body ?? {};

  if (typeof runId !== "string" || runId === "") return "runId must be a non-empty string";
  if (typeof name !== "string" || name.trim() === "" || name.trim().length > 20) return "The name must have 1 to 20 characters";
  if (!isInt(wins, 0, WINS_TO_VICTORY)) return `wins must be a whole number from 0 to ${WINS_TO_VICTORY}`;
  if (!isInt(lives, 0, START_LIVES)) return `lives must be a whole number from 0 to ${START_LIVES}`;

  // A finished run ended either with the last win or with the last life, never both.
  if ((wins === WINS_TO_VICTORY) === (lives === 0)) return `Only a finished run can enter: ${WINS_TO_VICTORY} wins or 0 lives left`;
  // Every battle is one round: a win or a lost life.
  if (rounds !== wins + (START_LIVES - lives)) return "rounds must equal wins plus lost lives";
  return null;
}

/**
 * Best first: more wins (so every victory is ahead of every defeat), then fewer rounds.
 * The sort is stable, so of two equal runs the one submitted earlier stays ahead.
 */
const compareRuns = (a, b) => b.wins - a.wins || a.rounds - b.rounds;

/** All entries, best first, each with its 1-based rank. */
export function rankRuns(entries) {
  return [...entries].sort(compareRuns).map((entry, index) => ({ rank: index + 1, ...entry }));
}

/**
 * Stores a validated run and returns it with its rank. A runId that is already stored
 * is not added again, so a retried submission is harmless.
 */
export function addRun(entries, body) {
  const { runId, name, wins, lives, rounds } = body;
  if (!entries.some((entry) => entry.runId === runId)) {
    const outcome = wins === WINS_TO_VICTORY ? "victory" : "defeat";
    entries.push({ runId, name: name.trim(), outcome, wins, lives, rounds });
  }
  return rankRuns(entries).find((entry) => entry.runId === runId);
}
