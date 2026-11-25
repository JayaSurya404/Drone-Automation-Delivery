import { millisecondsToSeconds, round2, safeAverage, safeRate } from "./analytics-math.util";

describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.236)).toBe(1.24);
    expect(round2(1.005001)).toBe(1.01);
  });
});

describe("safeRate", () => {
  it("returns null (not 0) when the denominator is zero — no data, not zero data", () => {
    expect(safeRate(0, 0)).toBeNull();
    expect(safeRate(5, 0)).toBeNull();
  });

  it("returns a genuine 0% when the numerator is 0 but the denominator is not", () => {
    expect(safeRate(0, 10)).toBe(0);
  });

  it("computes a percentage rounded to 2 decimals", () => {
    expect(safeRate(1, 3)).toBe(33.33);
  });

  it("returns 100 when numerator equals denominator", () => {
    expect(safeRate(10, 10)).toBe(100);
  });
});

describe("safeAverage", () => {
  it("returns null when count is 0", () => {
    expect(safeAverage(100, 0)).toBeNull();
  });

  it("computes a plain average rounded to 2 decimals", () => {
    expect(safeAverage(10, 3)).toBe(3.33);
  });

  it("returns 0 when the sum is 0 but count is positive", () => {
    expect(safeAverage(0, 5)).toBe(0);
  });
});

describe("millisecondsToSeconds", () => {
  it("converts and rounds to the nearest whole second", () => {
    expect(millisecondsToSeconds(1500)).toBe(2);
    expect(millisecondsToSeconds(1499)).toBe(1);
    expect(millisecondsToSeconds(0)).toBe(0);
  });
});
