import { NextResponse } from "next/server";
import { createDefaultClient, type GcsClient } from "@/lib/gcs";
import { listCases } from "@/lib/cases-index";

export type Deps = { client?: GcsClient; now?: Date };

function looksLikeAuthError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /401|403|UNAUTHENT|application[-_ ]default|could not load the default credentials/i.test(
    msg,
  );
}

export async function handleCases(rawUrl: string, deps: Deps = {}): Promise<NextResponse> {
  const url = new URL(rawUrl);
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days") ?? 7)));
  const bucket = process.env.GCS_BUCKET ?? "your-gcs-bucket-name";
  try {
    const client = deps.client ?? (await createDefaultClient(bucket));
    const result = await listCases({ client, days, now: deps.now });
    return NextResponse.json(result, {
      status: 200,
      headers: {
        // Browser + any downstream cache may reuse this for 5 minutes and
        // serve stale for another 10 while revalidating. Matches the
        // scheduled-rebuild cadence (10 min) for today's index.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
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
