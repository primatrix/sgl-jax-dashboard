import { NextResponse } from "next/server";
import { createDefaultClient, getDetail, type GcsClient } from "@/lib/gcs";

export type Deps = { client?: GcsClient };

function looksLikeAuthError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /401|403|UNAUTHENT|application[-_ ]default|could not load the default credentials/i.test(
    msg,
  );
}

export async function handleCase(rawUrl: string, deps: Deps = {}): Promise<NextResponse> {
  const url = new URL(rawUrl);
  const path = url.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }
  const bucket = process.env.GCS_BUCKET ?? "your-gcs-bucket-name";
  try {
    const client = deps.client ?? (await createDefaultClient(bucket));
    const result = await getDetail({ client, path });
    if (!result.ok) {
      return NextResponse.json({ error: result.error.reason }, { status: 404 });
    }
    return NextResponse.json(result.value, {
      status: 200,
      headers: {
        // Case object paths embed both the date and a per-run workload id,
        // so the underlying object is immutable once written. Safe to cache
        // aggressively at every layer.
        "Cache-Control": "public, max-age=31536000, immutable",
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
