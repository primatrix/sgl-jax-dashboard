import { describe, it, expect } from "vitest";
import {
  isAccuracySummary,
  isPerfSummary,
  isPerfCase,
  isAccuracyCase,
  primaryMetric,
  getMetric,
  metricsForType,
} from "@/lib/types";
import { samplePerf, sampleAccuracy } from "../helpers/fixtures";

const perf = samplePerf();
const acc = sampleAccuracy();

describe("type guards", () => {
  it("isPerfSummary narrows perf cases", () => {
    expect(isPerfSummary(perf)).toBe(true);
    expect(isPerfSummary(acc)).toBe(false);
  });
  it("isAccuracySummary narrows accuracy cases", () => {
    expect(isAccuracySummary(acc)).toBe(true);
    expect(isAccuracySummary(perf)).toBe(false);
  });
  it("isPerfCase / isAccuracyCase aliases still work", () => {
    expect(isPerfCase(perf)).toBe(true);
    expect(isAccuracyCase(acc)).toBe(true);
  });
});

describe("primaryMetric", () => {
  it("returns output_throughput for perf", () => {
    expect(primaryMetric(perf)).toEqual({ name: "output_throughput", value: 339.7 });
  });
  it("returns score for accuracy", () => {
    expect(primaryMetric(acc)).toEqual({ name: "score", value: 0.95 });
  });
});

describe("getMetric", () => {
  it("reads any perf scalar", () => {
    expect(getMetric(perf, "output_throughput")).toBe(339.7);
    expect(getMetric(perf, "median_ttft_ms")).toBe(84475.65);
    expect(getMetric(perf, "p99_e2e_latency_ms")).toBe(1500);
  });
  it("returns undefined when requesting a perf metric from an accuracy case", () => {
    expect(getMetric(acc, "output_throughput")).toBeUndefined();
  });
  it("reads score from accuracy", () => {
    expect(getMetric(acc, "score")).toBe(0.95);
  });
  it("returns undefined when requesting score from perf", () => {
    expect(getMetric(perf, "score")).toBeUndefined();
  });
});

describe("metricsForType", () => {
  it("lists perf metrics for perf type", () => {
    const list = metricsForType("perf");
    expect(list).toContain("output_throughput");
    expect(list).toContain("median_ttft_ms");
    expect(list).not.toContain("score");
  });
  it("lists only score for accuracy type", () => {
    expect(metricsForType("accuracy")).toEqual(["score"]);
  });
});
