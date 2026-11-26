import { describe, expect, it } from "vitest";
import { addRun, rankRuns, validateRun } from "./hallOfFame.js";

const victory = { runId: "run-a", name: "Mika", wins: 5, lives: 2, rounds: 6 };
const defeat = { runId: "run-b", name: "Alex", wins: 2, lives: 0, rounds: 5 };

describe("validateRun", () => {
  it.each([
    ["a victory", victory],
    ["a defeat", defeat],
    ["a flawless victory", { ...victory, lives: 3, rounds: 5 }],
  ])("accepts %s", (_case, run) => {
    expect(validateRun(run)).toBeNull();
  });

  it.each([
    ["no body", null],
    ["no runId", { ...victory, runId: undefined }],
    ["an empty name", { ...victory, name: "   " }],
    ["a name that is too long", { ...victory, name: "x".repeat(21) }],
    ["too many wins", { ...victory, wins: 6, rounds: 7 }],
    ["wins as text", { ...victory, wins: "5" }],
    ["too many lives", { ...victory, lives: 4 }],
    ["a run that is not over", { ...victory, wins: 4, lives: 1, rounds: 6 }],
    ["rounds that do not match", { ...victory, rounds: 2 }],
  ])("refuses %s", (_case, run) => {
    expect(validateRun(run)).toEqual(expect.any(String));
  });
});

describe("rankRuns", () => {
  it("puts more wins first, then fewer rounds, then the earlier entry", () => {
    const slowVictory = { ...victory, runId: "slow", rounds: 7, lives: 1 };
    const fastVictory = { ...victory, runId: "fast", rounds: 5, lives: 3 };
    const laterFast = { ...fastVictory, runId: "fast-later" };

    const ranked = rankRuns([defeat, slowVictory, fastVictory, laterFast]);

    expect(ranked.map((entry) => entry.runId)).toEqual(["fast", "fast-later", "slow", "run-b"]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3, 4]);
  });
});

describe("addRun", () => {
  it("stores a run with its outcome and trimmed name, and returns its rank", () => {
    const entries = [];
    addRun(entries, defeat);

    const entry = addRun(entries, { ...victory, name: "  Mika " });

    expect(entry).toMatchObject({ rank: 1, name: "Mika", outcome: "victory" });
  });

  it("never stores the same run twice", () => {
    const entries = [];
    addRun(entries, victory);

    const second = addRun(entries, { ...victory, name: "Someone else" });

    expect(second.name).toBe("Mika");
    expect(entries).toHaveLength(1);
  });
});
