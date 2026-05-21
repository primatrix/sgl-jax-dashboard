import { NextResponse } from "next/server";
import { listCases, createDefaultClient, type GcsClient } from "@/lib/gcs";

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
  const bucket = process.env.GCS_BUCKET ?? "observability-storage-sglang";
  try {
    const client = deps.client ?? (await createDefaultClient(bucket));
    const result = await listCases({ client, days, now: deps.now });
    return NextResponse.json(result, { status: 200 });
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
