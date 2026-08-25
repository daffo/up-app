import { getDifficultyLabel, getSentRating, getTriesByHoldId } from "../../utils/logs";
import { Log } from "../../types/database.types";

describe("getSentRating", () => {
  it("ignores attempted ratings", () => {
    const logs = [
      { status: "sent", quality_rating: 5 },
      { status: "attempted", quality_rating: 1 },
    ] as Log[];

    expect(getSentRating(logs)).toBe(5);
  });
});

describe("getTriesByHoldId", () => {
  it("includes failed holds retained on sent logs", () => {
    const logs = [
      { status: "attempted", fall_hold_id: "h1" },
      { status: "sent", fall_hold_id: "h1" },
      { status: "sent", fall_hold_id: null },
    ] as Log[];

    expect(getTriesByHoldId(logs)).toEqual({ h1: 2 });
  });
});

describe("getDifficultyLabel", () => {
  it('returns "Soft" for -1', () => {
    expect(getDifficultyLabel(-1)).toBe("Soft");
  });

  it('returns "Accurate" for 0', () => {
    expect(getDifficultyLabel(0)).toBe("Accurate");
  });

  it('returns "Hard" for 1', () => {
    expect(getDifficultyLabel(1)).toBe("Hard");
  });

  it("returns null for null", () => {
    expect(getDifficultyLabel(null)).toBeNull();
  });

  it("returns null for unexpected values", () => {
    expect(getDifficultyLabel(2)).toBeNull();
    expect(getDifficultyLabel(-2)).toBeNull();
  });
});
