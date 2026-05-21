import { NextResponse } from "next/server";
import { listCases, createDefaultClient, type GcsClient } from "@/lib/gcs";
import { buildTimeseries } from "@/lib/timeseries";
import type { Metric } from "@/lib/types";
import { metricsForType } from "@/lib/types";

export type Deps = { client?: GcsClient; now?: Date };

function looksLikeAuthError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /401|403|UNAUTHENT|application[-_ ]default|could not load the default credentials/i.test(
    msg,
  );
}

function parseMetric(raw: string | null): Metric | undefined {
  if (!raw) return undefined;
  const all = [...metricsForType("perf"), ...metricsForType("accuracy")];
  return all.includes(raw as Metric) ? (raw as Metric) : undefined;
}

export async function handleTimeseries(rawUrl: string, deps: Deps = {}): Promise<NextResponse> {
  const url = new URL(rawUrl);
  const caseName = url.searchParams.get("case");
  const profile = url.searchParams.get("profile");
  const target = url.searchParams.get("target");
  if (!caseName || !profile || !target) {
    return NextResponse.json(
      { error: "case, profile, target are required" },
      { status: 400 },
    );
  }
  const metric = parseMetric(url.searchParams.get("metric"));
  const rawMetric = url.searchParams.get("metric");
  if (rawMetric && !metric) {
    return NextResponse.json({ error: `unknown metric: ${rawMetric}` }, { status: 400 });
  }
  const days = Math.max(1, Math.min(180, Number(url.searchParams.get("days") ?? 30)));
  const bucket = process.env.GCS_BUCKET ?? "observability-storage-sglang";
  try {
    const client = deps.client ?? (await createDefaultClient(bucket));
    const { cases } = await listCases({ client, days, now: deps.now });
    try {
      const series = buildTimeseries(cases, { case: caseName, profile, target }, metric);
      return NextResponse.json(series, { status: 200 });
    } catch {
      return NextResponse.json({ error: "no matching case in window" }, { status: 404 });
    }
  } catch (e) {
    if (looksLikeAuthError(e)) {
      return NextResponse.json(
        {
          error:
            "Cannot read GCS bucket. Run `gcloud auth application-default login` and ensure the active account has roles/storage.objectViewer on the bucket.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
