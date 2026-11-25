import { BadRequestException } from "@nestjs/common";
import { MAX_CUSTOM_RANGE_DAYS, resolveDateRange } from "./date-range.util";

const NOW = new Date("2026-06-15T14:30:00.000Z");

describe("resolveDateRange", () => {
  it("defaults to the last 30 days when nothing is given", () => {
    const result = resolveDateRange({}, NOW);
    expect(result.to).toEqual(NOW);
    expect(result.from).toEqual(new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000));
  });

  it("resolves the '7d' preset to exactly 7 days before now", () => {
    const result = resolveDateRange({ preset: "7d" }, NOW);
    expect(result.from).toEqual(new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000));
    expect(result.to).toEqual(NOW);
  });

  it("resolves the '30d' preset explicitly the same as the default", () => {
    expect(resolveDateRange({ preset: "30d" }, NOW)).toEqual(resolveDateRange({}, NOW));
  });

  it("resolves 'today' to the start of the current UTC calendar day through now — a partial window", () => {
    const result = resolveDateRange({ preset: "today" }, NOW);
    expect(result.from).toEqual(new Date("2026-06-15T00:00:00.000Z"));
    expect(result.to).toEqual(NOW);
    expect(result.to.getTime()).toBeGreaterThan(result.from.getTime());
  });

  it("accepts a valid custom range", () => {
    const result = resolveDateRange({ from: "2026-01-01T00:00:00.000Z", to: "2026-01-31T00:00:00.000Z" }, NOW);
    expect(result.from).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(result.to).toEqual(new Date("2026-01-31T00:00:00.000Z"));
  });

  it("accepts a zero-width custom range (from equals to)", () => {
    const result = resolveDateRange({ from: "2026-01-01T00:00:00.000Z", to: "2026-01-01T00:00:00.000Z" }, NOW);
    expect(result.from).toEqual(result.to);
  });

  it("rejects a custom range with only 'from' provided", () => {
    expect(() => resolveDateRange({ from: "2026-01-01T00:00:00.000Z" }, NOW)).toThrow(BadRequestException);
  });

  it("rejects a custom range with only 'to' provided", () => {
    expect(() => resolveDateRange({ to: "2026-01-01T00:00:00.000Z" }, NOW)).toThrow(BadRequestException);
  });

  it("rejects an invalid date string", () => {
    expect(() => resolveDateRange({ from: "not-a-date", to: "2026-01-01T00:00:00.000Z" }, NOW)).toThrow(BadRequestException);
  });

  it("rejects 'from' after 'to'", () => {
    expect(() => resolveDateRange({ from: "2026-02-01T00:00:00.000Z", to: "2026-01-01T00:00:00.000Z" }, NOW)).toThrow(BadRequestException);
  });

  it("rejects a custom range wider than the maximum allowed days (large-range query protection)", () => {
    const from = "2020-01-01T00:00:00.000Z";
    const to = new Date(new Date(from).getTime() + (MAX_CUSTOM_RANGE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    expect(() => resolveDateRange({ from, to }, NOW)).toThrow(BadRequestException);
  });

  it("accepts a custom range exactly at the maximum allowed days", () => {
    const from = "2020-01-01T00:00:00.000Z";
    const to = new Date(new Date(from).getTime() + MAX_CUSTOM_RANGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    expect(() => resolveDateRange({ from, to }, NOW)).not.toThrow();
  });

  it("ignores the preset field when explicit from/to is also given", () => {
    const result = resolveDateRange({ preset: "today", from: "2026-01-01T00:00:00.000Z", to: "2026-01-02T00:00:00.000Z" }, NOW);
    expect(result.from).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });
});
