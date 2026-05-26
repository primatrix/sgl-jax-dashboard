import { NextResponse } from "next/server";
import { createDefaultClient, type GcsClient } from "@/lib/gcs";
import { buildIndexForDate, indexObjectName, writeIndex } from "@/lib/cases-index";

/**
 * Cloud Scheduler hits this endpoint on a fixed cron to refresh today's
 * aggregated case-summary index. Authentication is via Google-signed OIDC ID
 * tokens; we verify the signature, then check that the `email` claim matches
 * the dedicated scheduler service account. Any other caller gets a 401/403.
 */

export type VerifiedIdentity = { email: string };

export type VerifyOidc = (token: string) => Promise<VerifiedIdentity | null>;

export type RebuildDeps = {
  client?: GcsClient;
  verifyOidc?: VerifyOidc;
  now?: Date;
};

const SCHEDULER_EMAIL_ENV = "SCHEDULER_SA_EMAIL";
const AUDIENCE_ENV = "REBUILD_AUDIENCE";
const BUCKET_ENV = "GCS_BUCKET";

function defaultVerifier(): VerifyOidc {
  return async (token: string) => {
    const expectedAud = process.env[AUDIENCE_ENV];
    if (!expectedAud) return null;
    const { OAuth2Client } = await import("google-auth-library");
    const oauth = new OAuth2Client();
    try {
      const ticket = await oauth.verifyIdToken({ idToken: token, audience: expectedAud });
      const payload = ticket.getPayload();
      if (!payload?.email || payload.email_verified === false) return null;
      return { email: payload.email };
    } catch {
      return null;
    }
  };
}

function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h) return null;
  // RFC 7235: HTTP auth scheme is case-insensitive.
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

export async function handleRebuildToday(
  req: Request,
  deps: RebuildDeps = {},
): Promise<NextResponse> {
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "missing bearer token" }, { status: 401 });
  }
  const verify = deps.verifyOidc ?? defaultVerifier();
  const identity = await verify(token);
  if (!identity) {
    return NextResponse.json({ error: "invalid id token" }, { status: 401 });
  }
  const expectedEmail = process.env[SCHEDULER_EMAIL_ENV];
  if (
    !expectedEmail ||
    identity.email.toLowerCase() !== expectedEmail.toLowerCase()
  ) {
    return NextResponse.json({ error: "caller not authorized" }, { status: 403 });
  }

  const bucket = process.env[BUCKET_ENV] ?? "your-gcs-bucket-name";
  const client = deps.client ?? (await createDefaultClient(bucket));
  const now = deps.now ?? new Date();
  const today = now.toISOString().slice(0, 10);

  try {
    const built = await buildIndexForDate(client, today, now);
    await writeIndex(client, built);
    return NextResponse.json(
      {
        date: today,
        built_at: built.built_at,
        cases: built.cases.length,
        errors: built.errors.length,
        object: indexObjectName(today),
      },
      { status: 200 },
    );
  } catch (e) {
    // 500 path was previously silent — that made the Scheduler 500 untriaged.
    console.error(`rebuild-today: build/write failed for ${today}:`, e);
    return NextResponse.json(
      { error: (e as Error).message, date: today },
      { status: 500 },
    );
  }
}
