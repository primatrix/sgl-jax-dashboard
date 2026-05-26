import { describe, it, expect } from "vitest";
import {
  buildIndexForDate,
  indexObjectName,
  isIndexStale,
  readIndex,
  writeIndex,
} from "@/lib/cases-index";
import { CASES_INDEX_VERSION, type CasesIndex } from "@/lib/types";
import { makeFakeGcsClient } from "../helpers/fixtures";

const PERF = JSON.stringify({
  type: "perf", case: "bench", profile: "p", target: "v6e-4x4",
  completed: 1, median_ttft_ms: 1, median_itl_ms: 1,
  input_throughput: 1, output_throughput: 100, request_throughput: 1,
});
const ACC = JSON.stringify({
  type: "accuracy", case: "gsm8k", profile: "p", target: "v6e-4x4",
  dataset: "gsm8k", model_id: "x/y", score: 0.9,
});

describe("indexObjectName", () => {
  it("maps a date to the canonical _indexes/ path", () => {
    expect(indexObjectName("2026-05-19")).toBe("_indexes/2026-05-19.json");
  });
});

describe("readIndex", () => {
  it("returns null when the object is missing", async () => {
    const client = makeFakeGcsClient({});
    const idx = await readIndex(client, "2026-05-19");
    expect(idx).toBeNull();
  });

  it("returns null when the JSON is malformed", async () => {
    const client = makeFakeGcsClient({
      "_indexes/2026-05-19.json": { body: "not json", updated: "2026-05-19T01:00:00Z" },
    });
    expect(await readIndex(client, "2026-05-19")).toBeNull();
  });

  it("returns null when the schema version does not match", async () => {
    const client = makeFakeGcsClient({
      "_indexes/2026-05-19.json": {
        body: JSON.stringify({
          version: 999,
          date: "2026-05-19",
          built_at: "2026-05-19T00:00:00Z",
          cases: [],
          errors: [],
        }),
        updated: "2026-05-19T01:00:00Z",
      },
    });
    expect(await readIndex(client, "2026-05-19")).toBeNull();
  });

  it("returns null when the encoded date disagrees with the request", async () => {
    const client = makeFakeGcsClient({
      "_indexes/2026-05-19.json": {
        body: JSON.stringify({
          version: CASES_INDEX_VERSION,
          date: "2026-05-18",
          built_at: "2026-05-19T00:00:00Z",
          cases: [],
          errors: [],
        }),
        updated: "2026-05-19T01:00:00Z",
      },
    });
    expect(await readIndex(client, "2026-05-19")).toBeNull();
  });

  it("round-trips a valid index", async () => {
    const idx: CasesIndex = {
      version: CASES_INDEX_VERSION,
      date: "2026-05-19",
      built_at: "2026-05-19T00:00:00Z",
      cases: [],
      errors: [],
    };
    const client = makeFakeGcsClient({});
    await writeIndex(client, idx);
    const got = await readIndex(client, "2026-05-19");
    expect(got).toEqual(idx);
  });
});

describe("buildIndexForDate", () => {
  it("aggregates summaries for every case under the date prefix", async () => {
    const client = makeFakeGcsClient({
      "2026-05-18/run-1/bench.json": { body: PERF, updated: "2026-05-18T01:00:00Z" },
      "2026-05-18/run-1/gsm8k.json": { body: ACC, updated: "2026-05-18T01:00:00Z" },
      "2026-05-18/run-1/": { body: "", updated: "2026-05-18T00:00:00Z" },
      "2026-05-19/run-2/bench.json": { body: PERF, updated: "2026-05-19T01:00:00Z" },
    });
    const built = await buildIndexForDate(client, "2026-05-18", new Date("2026-05-19T02:00:00Z"));
    expect(built.date).toBe("2026-05-18");
    expect(built.cases).toHaveLength(2);
    expect(built.errors).toEqual([]);
    expect(built.built_at).toBe("2026-05-19T02:00:00.000Z");
    expect(built.version).toBe(CASES_INDEX_VERSION);
  });

  it("collects per-file parse errors instead of throwing", async () => {
    const client = makeFakeGcsClient({
      "2026-05-18/run-1/bad.json": { body: "not json", updated: "2026-05-18T00:00:00Z" },
      "2026-05-18/run-1/ok.json": { body: PERF, updated: "2026-05-18T00:00:00Z" },
    });
    const built = await buildIndexForDate(client, "2026-05-18", new Date("2026-05-19T00:00:00Z"));
    expect(built.cases).toHaveLength(1);
    expect(built.errors).toHaveLength(1);
    expect(built.errors[0].path).toBe("2026-05-18/run-1/bad.json");
  });

  it("returns an empty index when the day has no case files", async () => {
    const client = makeFakeGcsClient({});
    const built = await buildIndexForDate(client, "2026-05-18", new Date("2026-05-19T00:00:00Z"));
    expect(built.cases).toEqual([]);
    expect(built.errors).toEqual([]);
  });
});

describe("isIndexStale", () => {
  const base: CasesIndex = {
    version: CASES_INDEX_VERSION,
    date: "2026-05-19",
    built_at: "2026-05-19T00:00:00Z",
    cases: [],
    errors: [],
  };

  it("is fresh inside the window", () => {
    const now = new Date("2026-05-19T00:09:00Z"); // 9 min later
    expect(isIndexStale(base, now, 10 * 60 * 1000)).toBe(false);
  });

  it("is stale past the window", () => {
    const now = new Date("2026-05-19T00:11:00Z"); // 11 min later
    expect(isIndexStale(base, now, 10 * 60 * 1000)).toBe(true);
  });

  it("treats an unparseable built_at as stale", () => {
    const bad = { ...base, built_at: "garbage" };
    expect(isIndexStale(bad, new Date(), 60_000)).toBe(true);
  });
});
