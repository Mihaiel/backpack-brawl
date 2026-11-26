import { useEffect, useState, type ReactNode } from "react";
import { newGame } from "../game/game";
import { loadSavedGame, serializeGame } from "../game/save";
import type { GameState } from "../game/types";
import { GameContext, type GameContextValue } from "./GameContext";

const randomSeed = () => Math.floor(Math.random() * 2 ** 32);

/** B6: where the run is kept in the browser. */
const SAVE_KEY = "backpack-brawl-save";

// Where we actually read the state
function readSave(): GameState | null {
  try {
    return loadSavedGame(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

/** Holds the game state for all routes, so it survives navigating between pages. */
export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<GameState | null>(readSave);

  // B6: save after every change, so a refresh can continue the run.
  useEffect(() => {
    if (!game) return;
    try {
      localStorage.setItem(SAVE_KEY, serializeGame(game));
    } catch {
      // storage full or blocked: the game still works, it just is not saved
    }
  }, [game]);

  const value: GameContextValue = {
    game,
    
    // B7: every run gets a random id, so the hall of fame can recognise it.
    startNewRun: () => setGame(newGame(randomSeed(), crypto.randomUUID())),
    update: (transition) => setGame((current) => (current ? transition(current) : current)),
  };

  return <GameContext value={value}>{children}</GameContext>;
}
