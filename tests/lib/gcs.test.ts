import { describe, it, expect } from "vitest";
import { listCases, type GcsClient } from "@/lib/gcs";

function makeFakeClient(objects: Record<string, { body: string; updated: string }>): GcsClient {
  return {
    async listObjects(prefix) {
      return Object.keys(objects)
        .filter((n) => n.startsWith(prefix))
        .map((name) => ({ name, updated: objects[name].updated }));
    },
    async getObject(name) {
      const o = objects[name];
      if (!o) throw new Error(`not found: ${name}`);
      return o.body;
    },
    async statObject(name) {
      const o = objects[name];
      if (!o) throw new Error(`not found: ${name}`);
      return { name, updated: o.updated };
    },
  };
}

const PERF = JSON.stringify({
  type: "perf", case: "bench", profile: "p", target: "v6e-4x4",
  completed: 1, median_ttft_ms: 1, median_itl_ms: 1,
  input_throughput: 1, output_throughput: 100, request_throughput: 1,
});
const ACC = JSON.stringify({
  type: "accuracy", case: "gsm8k", profile: "p", target: "v6e-4x4",
  dataset: "gsm8k", model_id: "x/y", score: 0.9,
});

describe("listCases", () => {
  it("lists case files across the last N days, skipping placeholders and logs/", async () => {
    const today = new Date("2026-05-19T00:00:00Z");
    const client = makeFakeClient({
      "2026-05-18/": { body: "", updated: "2026-05-18T00:00:00Z" },
      "2026-05-18/run-1/": { body: "", updated: "2026-05-18T00:00:00Z" },
      "2026-05-18/run-1/bench.json": { body: PERF, updated: "2026-05-18T01:00:00Z" },
      "2026-05-18/run-1/gsm8k.json": { body: ACC, updated: "2026-05-18T01:00:00Z" },
      "2026-05-19/run-2/bench.json": { body: PERF, updated: "2026-05-19T01:00:00Z" },
      "logs/build.log": { body: "log", updated: "2026-05-19T00:00:00Z" },
    });

    const { cases, errors } = await listCases({ client, days: 7, now: today });

    expect(errors).toEqual([]);
    expect(cases).toHaveLength(3);
    expect(cases[0].date).toBe("2026-05-19");
    expect(cases[1].date).toBe("2026-05-18");
    expect(cases[2].date).toBe("2026-05-18");
  });

  it("respects the days window", async () => {
    const today = new Date("2026-05-19T00:00:00Z");
    const client = makeFakeClient({
      "2026-05-01/run-1/bench.json": { body: PERF, updated: "2026-05-01T00:00:00Z" },
      "2026-05-18/run-2/bench.json": { body: PERF, updated: "2026-05-18T00:00:00Z" },
    });
    const { cases } = await listCases({ client, days: 7, now: today });
    expect(cases.map((c) => c.date)).toEqual(["2026-05-18"]);
  });

  it("collects per-file parse errors but does not throw", async () => {
    const today = new Date("2026-05-19T00:00:00Z");
    const client = makeFakeClient({
      "2026-05-18/run-1/bad.json": { body: "not json", updated: "2026-05-18T00:00:00Z" },
      "2026-05-18/run-1/ok.json": { body: PERF, updated: "2026-05-18T00:00:00Z" },
    });
    const { cases, errors } = await listCases({ client, days: 7, now: today });
    expect(cases).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe("2026-05-18/run-1/bad.json");
  });
});
