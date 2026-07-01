import { parseFrenchGradeNumber } from "../../utils/grade";

describe("parseFrenchGradeNumber", () => {
  it("reads the main number, ignoring letters and +", () => {
    expect(parseFrenchGradeNumber("5a")).toBe(5);
    expect(parseFrenchGradeNumber("5a+")).toBe(5);
    expect(parseFrenchGradeNumber("6a")).toBe(6);
    expect(parseFrenchGradeNumber("6c+")).toBe(6);
    expect(parseFrenchGradeNumber("7b")).toBe(7);
    expect(parseFrenchGradeNumber("8")).toBe(8);
  });

  it("tolerates surrounding whitespace and uppercase letters", () => {
    expect(parseFrenchGradeNumber("  6A ")).toBe(6);
  });

  it("returns null for non-French / unparseable grades", () => {
    expect(parseFrenchGradeNumber("V5")).toBeNull();
    expect(parseFrenchGradeNumber("project")).toBeNull();
    expect(parseFrenchGradeNumber("")).toBeNull();
    expect(parseFrenchGradeNumber(null)).toBeNull();
    expect(parseFrenchGradeNumber(undefined)).toBeNull();
  });

  it("parses two-digit leading numbers as-is (clamping is the caller's job)", () => {
    expect(parseFrenchGradeNumber("10a")).toBe(10);
  });
});
