# Backpack Brawl API

The local API is a small Express server in `server/index.js`. It listens on port 4200 (override with the `PORT` environment variable). During Vite development, `/api` is proxied to it, so the frontend uses relative URLs such as `/api/opponents?round=1`. All responses are JSON. The only state on the server is the hall of fame, which is stored in `server/hall-of-fame.json` and survives a restart.

## `GET /api/health`

Always answers immediately with status 200:

```json
{ "ok": true, "service": "backpack-brawl" }
```

## `GET /api/opponents`

Returns the opponent for one round of a run. The opponent table lives in `server/opponents.js`.

### Query parameters

| Parameter | Required | Meaning |
|---|---|---|
| `round` | yes | The 1-based round number. Must be a positive whole number written in digits (`1`, `2`, …). |
| `latency` | no | Response delay in milliseconds, clamped to 0–5000. Defaults to 1200. A value that is not a number falls back to the default. |
| `fail` | no | `fail=true` forces a 503 response (see below). |

### Success — 200

```json
{
  "id": "mossback-hermit",
  "name": "Mossback Hermit",
  "icon": "🐢",
  "hp": 25,
  "items": ["chipped-dagger", "pot-lid"],
  "round": 1
}
```

| Field | Type | Meaning |
|---|---|---|
| `id` | string | Stable identifier of the opponent |
| `name` | string | Display name |
| `icon` | string | Emoji shown in the battle view |
| `hp` | number | Maximum (and starting) HP |
| `items` | string[] | Item ids from the catalog in `src/game/items.ts`; the same id may appear several times |
| `round` | number | The round this opponent was requested for (echoes `round`) |

The response matches the `Opponent` type in `src/game/types.ts`.

The answer is deterministic: the same `round` always returns the same opponent. There is one hand-built opponent per round for rounds 1–7. Every round past the table returns the last opponent with +6 HP per additional round. The table never needs more than 7 rounds (5 wins + 3 lives − 1), and an opponent never carries more than 6 items, the size of the player's 2×3 backpack.

### Errors

Every error response has the shape:

```json
{ "error": "human-readable explanation" }
```

| Status | When | `error` |
|---|---|---|
| 400 | `round` is missing, not a whole number, or less than 1 | `round must be a positive whole number` |
| 503 | `fail=true`, or the server was started with `API_FAIL=true` | `The arena gates are shut. No challenger answered the call.` |

An invalid `round` is reported as 400 even when failure is forced. All responses from this endpoint, errors included, arrive after the configured delay.

## Hall of fame (B7)

Finished runs. The server keeps them in a list and writes the whole list to `server/hall-of-fame.json` after every submission; at start it reads the file again. Without the file it starts empty. A file that is not valid JSON stops the server with an error instead of being overwritten; delete or fix it to start again. The file is in `.gitignore`. The rules live in `server/hallOfFame.js`. Both endpoints answer at once; they have no `latency` or `fail` parameters. To see the error state in the app, stop the API (`pnpm exec vite` runs only the front end).

### Ranking

Best first: more `wins`, then fewer `rounds`. Every victory has 5 wins, so all victories come before all defeats. Of two equal runs, the one submitted earlier stays ahead.

### Entry

| Field | Type | Meaning |
|---|---|---|
| `rank` | number | 1-based position in the ranking |
| `runId` | string | Random id of the run, made by the client when the run starts |
| `name` | string | The player's name, trimmed |
| `outcome` | `"victory"` \| `"defeat"` | `victory` when `wins` is 5 |
| `wins` | number | Wins of the run (0–5) |
| `lives` | number | Lives left at the end (0–3) |
| `rounds` | number | Battles played |

The entry matches the `HallOfFameEntry` type in `src/game/types.ts`.

### `GET /api/hall-of-fame`

Returns the best 10 runs as an array of entries, best first. Before the first submission it returns `[]`.

```json
[
  { "rank": 1, "runId": "7f3c…", "name": "Mika", "outcome": "victory", "wins": 5, "lives": 2, "rounds": 6 },
  { "rank": 2, "runId": "a91e…", "name": "Alex", "outcome": "defeat", "wins": 2, "lives": 0, "rounds": 5 }
]
```

### `POST /api/hall-of-fame`

Submits a finished run. The body is JSON (`Content-Type: application/json`):

```json
{ "runId": "7f3c…", "name": "Mika", "wins": 5, "lives": 2, "rounds": 6 }
```

| Field | Rule |
|---|---|
| `runId` | non-empty string |
| `name` | string, 1 to 20 characters after trimming |
| `wins` | whole number from 0 to 5 |
| `lives` | whole number from 0 to 3 |
| (finished) | exactly one of `wins = 5` and `lives = 0`: only a finished run can enter |
| `rounds` | must equal `wins + (3 − lives)`: every battle is one round, either a win or a lost life |

Answers:

| Status | When | Body |
|---|---|---|
| 201 | The run is stored. If a run with this `runId` was already stored, nothing is added and the stored entry comes back, so a retried submission is harmless. | the entry with its `rank` |
| 400 | The body is not valid JSON, or a field breaks a rule above | `{ "error": "…" }` naming the first problem, for example `The name must have 1 to 20 characters` or `rounds must equal wins plus lost lives` |

The server only checks that the numbers of a run fit together; it cannot prove that the battles were really played.

## Environment variables

| Variable | Effect |
|---|---|
| `PORT` | Port to listen on (default 4200). The Vite proxy expects 4200. |
| `API_LATENCY` | Default delay in milliseconds when a request has no `latency` parameter. |
| `API_FAIL` | `true` makes every opponent request fail with 503. |

Example: `API_FAIL=true pnpm server`.

## Client

`fetchOpponent(round)`, `fetchHallOfFame()` and `submitRun(run)` in `src/api.ts` perform the requests. They share one helper, `readJson`. Each resolves with the parsed answer on success and throws an `Error` carrying the server's `error` text (or a generic message with the status code) for any non-2xx response. When the API is not running, the Vite proxy answers with an error status of its own, which is reported the same way; a network failure rejects as well.
