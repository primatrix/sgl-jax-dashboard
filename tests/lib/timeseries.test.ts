import { describe, it, expect } from "vitest";
import { buildTimeseries, listSelectors } from "@/lib/timeseries";
import type { CaseSummary } from "@/lib/types";
import { samplePerf, sampleAccuracy } from "../helpers/fixtures";

function perf(date: string, output_throughput: number): CaseSummary {
  return samplePerf({ date, output_throughput, path: `${date}/run-1/bench.json` });
}

function acc(date: string, score: number): CaseSummary {
  return sampleAccuracy({ date, score, path: `${date}/run-1/gsm8k.json` });
}

describe("buildTimeseries", () => {
  it("picks output_throughput for perf cases", () => {
    const cases: CaseSummary[] = [perf("2026-05-17", 100), perf("2026-05-18", 200)];
    const r = buildTimeseries(cases, {
      case: "bench",
      profile: "p",
      target: "v6e-4x4",
    });
    expect(r.metric).toBe("output_throughput");
    expect(r.points.map((p) => p.value)).toEqual([100, 200]);
    expect(r.points.map((p) => p.date)).toEqual(["2026-05-17", "2026-05-18"]);
  });

  it("picks score for accuracy cases", () => {
    const cases: CaseSummary[] = [acc("2026-05-18", 0.9), acc("2026-05-17", 0.8)];
    const r = buildTimeseries(cases, {
      case: "gsm8k",
      profile: "p",
      target: "v6e-4x4",
    });
    expect(r.metric).toBe("score");
    expect(r.points.map((p) => p.value)).toEqual([0.8, 0.9]);
  });

  it("filters by (case, profile, target) triple", () => {
    const cases: CaseSummary[] = [
      perf("2026-05-18", 100),
      samplePerf({
        date: "2026-05-18",
        output_throughput: 999,
        profile: "other",
        path: "2026-05-18/run-1/other.json",
      }),
    ];
    const r = buildTimeseries(cases, {
      case: "bench",
      profile: "p",
      target: "v6e-4x4",
    });
    expect(r.points).toHaveLength(1);
    expect(r.points[0].value).toBe(100);
  });

  it("throws when no matching case is present (selector invariant)", () => {
    expect(() =>
      buildTimeseries([], { case: "x", profile: "y", target: "z" }),
    ).toThrow();
  });
});

describe("listSelectors", () => {
  it("dedupes by (case, profile, target) triple", () => {
    const cases = [perf("2026-05-17", 1), perf("2026-05-18", 2)];
    expect(listSelectors(cases)).toHaveLength(1);
  });

  it("sorts case-then-profile alphabetically", () => {
    const cases = [
      sampleAccuracy({ case: "z" }),
      samplePerf({ case: "a" }),
      sampleAccuracy({ case: "m" }),
    ];
    expect(listSelectors(cases).map((s) => s.case)).toEqual(["a", "m", "z"]);
  });
});
