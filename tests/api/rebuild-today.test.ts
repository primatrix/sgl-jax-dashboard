import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleRebuildToday } from "@/lib/api/rebuild-today-handler";
import { makeFakeGcsClient } from "../helpers/fixtures";

const PERF = JSON.stringify({
  type: "perf", case: "bench", profile: "p", target: "v6e-4x4",
  completed: 1, median_ttft_ms: 1, median_itl_ms: 1,
  input_throughput: 1, output_throughput: 100, request_throughput: 1,
});

const SCHEDULER_EMAIL = "test-scheduler@example.iam.gserviceaccount.com";

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/rebuild-today", {
    method: "POST",
    headers,
  });
}

describe("POST /api/rebuild-today", () => {
  beforeEach(() => {
    vi.stubEnv("SCHEDULER_SA_EMAIL", SCHEDULER_EMAIL);
    vi.stubEnv("GCS_BUCKET", "test-bucket");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const client = makeFakeGcsClient({});
    const res = await handleRebuildToday(makeReq(), {
      client,
      verifyOidc: async () => ({ email: SCHEDULER_EMAIL }),
      now: new Date("2026-05-19T00:00:00Z"),
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when the id token fails verification", async () => {
    const client = makeFakeGcsClient({});
    const res = await handleRebuildToday(
      makeReq({ authorization: "Bearer bad-token" }),
      {
        client,
        verifyOidc: async () => null,
        now: new Date("2026-05-19T00:00:00Z"),
      },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller is a different service account", async () => {
    const client = makeFakeGcsClient({});
    const res = await handleRebuildToday(
      makeReq({ authorization: "Bearer good-token" }),
      {
        client,
        verifyOidc: async () => ({ email: "someone-else@example.com" }),
        now: new Date("2026-05-19T00:00:00Z"),
      },
    );
    expect(res.status).toBe(403);
  });

  it("rebuilds today's index and writes it back when the caller is authorized", async () => {
    const client = makeFakeGcsClient({
      "2026-05-19/run-1/bench.json": { body: PERF, updated: "2026-05-19T01:00:00Z" },
    });
    const res = await handleRebuildToday(
      makeReq({ authorization: "Bearer good-token" }),
      {
        client,
        verifyOidc: async () => ({ email: SCHEDULER_EMAIL }),
        now: new Date("2026-05-19T00:30:00Z"),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe("2026-05-19");
    expect(body.cases).toBe(1);
    expect(body.object).toBe("_indexes/2026-05-19.json");
    // Index now lives in the bucket.
    expect(client.objects.has("_indexes/2026-05-19.json")).toBe(true);
  });
});
