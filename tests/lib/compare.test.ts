import { describe, it, expect } from "vitest";
import { compareMetric } from "@/lib/compare";
import { samplePerf, sampleAccuracy } from "../helpers/fixtures";

describe("compareMetric", () => {
  it("returns no previous and null delta for the only run of a selector", () => {
    const a = samplePerf({ date: "2026-05-19", output_throughput: 339, path: "a" });
    const r = compareMetric([a], a, "output_throughput");
    expect(r.previous).toBeNull();
    expect(r.delta).toBeNull();
    expect(r.history).toEqual([339]);
  });

  it("computes signed delta against the previous run of the same selector", () => {
    const older = samplePerf({ date: "2026-05-17", output_throughput: 100, path: "o" });
    const newer = samplePerf({ date: "2026-05-19", output_throughput: 110, path: "n" });
    const r = compareMetric([older, newer], newer, "output_throughput");
    expect(r.previous).toBe(100);
    expect(r.delta).toBeCloseTo(0.1);          // +10%
    expect(r.history).toEqual([100, 110]);     // ASC for sparkline
  });

  it("ignores cases from different selectors", () => {
    const me = samplePerf({ date: "2026-05-19", output_throughput: 100, path: "p" });
    const other = samplePerf({ case: "other", output_throughput: 9999, path: "q" });
    const r = compareMetric([me, other], me, "output_throughput");
    expect(r.history).toEqual([100]);
    expect(r.previous).toBeNull();
  });

  it("uses (date, updated) ascending for history ordering", () => {
    const a = samplePerf({ date: "2026-05-17", updated: "2026-05-17T01:00:00Z", output_throughput: 1, path: "a" });
    const b = samplePerf({ date: "2026-05-18", updated: "2026-05-18T01:00:00Z", output_throughput: 2, path: "b" });
    const c = samplePerf({ date: "2026-05-18", updated: "2026-05-18T05:00:00Z", output_throughput: 3, path: "c" });
    // give them shuffled to make sure compare sorts internally
    const r = compareMetric([c, a, b], c, "output_throughput");
    expect(r.history).toEqual([1, 2, 3]);
    expect(r.previous).toBe(2);
  });

  it("returns delta=null when previous value is 0", () => {
    const a = samplePerf({ date: "2026-05-17", output_throughput: 0, path: "a" });
    const b = samplePerf({ date: "2026-05-18", output_throughput: 5, path: "b" });
    const r = compareMetric([a, b], b, "output_throughput");
    expect(r.previous).toBe(0);
    expect(r.delta).toBeNull();
  });

  it("works on accuracy.score metric", () => {
    const a = sampleAccuracy({ date: "2026-05-17", score: 0.9, path: "a" });
    const b = sampleAccuracy({ date: "2026-05-18", score: 0.95, path: "b" });
    const r = compareMetric([a, b], b, "score");
    expect(r.previous).toBe(0.9);
    expect(r.delta).toBeCloseTo(0.0556, 3);
  });
});
