import cors from "cors";
import express from "express";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { addRun, rankRuns, TOP_COUNT, validateRun } from "./hallOfFame.js";
import { opponentForRound, parseRound } from "./opponents.js";

const app = express();
const port = Number(process.env.PORT ?? 4200);

app.use(cors()); app.use(express.json());
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "backpack-brawl" }));

// .../?round=2&latency=0
app.get("/api/opponents", (req, res) => {
  // latency parameter
  const requested = Number(req.query.latency ?? process.env.API_LATENCY ?? 1200);
  
  const latency = Number.isFinite(requested) ? Math.max(0, Math.min(5000, requested)) : 1200;
  setTimeout(() => {
    // round parameter
    const round = parseRound(req.query.round);

    if (round === null) return res.status(400).json({ error: "round must be a positive whole number" });
    if (req.query.fail === "true" || process.env.API_FAIL === "true") {
      return res.status(503).json({ error: "The arena gates are shut. No challenger answered the call." });
    }
    res.json(opponentForRound(round));
  }, latency);
});

// B7: the hall of fame is kept in this file, so it survives a server restart.
// No file yet: start empty. A broken file stops the server with an error, instead of being overwritten.
const HALL_FILE = new URL("./hall-of-fame.json", import.meta.url);
const hallOfFame = existsSync(HALL_FILE) ? JSON.parse(readFileSync(HALL_FILE, "utf8")) : [];

app.get("/api/hall-of-fame", (_req, res) => {
  res.json(rankRuns(hallOfFame).slice(0, TOP_COUNT));
});

app.post("/api/hall-of-fame", (req, res) => {
  const error = validateRun(req.body);
  if (error) return res.status(400).json({ error });
  const entry = addRun(hallOfFame, req.body);
  writeFileSync(HALL_FILE, JSON.stringify(hallOfFame, null, 2)); // the whole list, after every submission
  res.status(201).json(entry);
});

// B7: a body that is not valid JSON gets the same { error } answer as every other error.
app.use((_err, _req, res, _next) => res.status(400).json({ error: "The body must be valid JSON" }));

app.listen(port, () => console.log(`Backpack Brawl API listening on http://localhost:${port}`));
