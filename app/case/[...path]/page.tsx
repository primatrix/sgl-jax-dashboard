import Link from "next/link";
import { notFound } from "next/navigation";
import { createDefaultClient, getDetail } from "@/lib/gcs";
import {
  AccuracyCard,
  ExtraCard,
  LatencyCard,
  RunConfigCard,
  SamplesCard,
  ServerInfoCard,
  ThroughputCard,
  TokensCard,
} from "@/components/case/Cards";

export const dynamic = "force-dynamic";

function ghRunUrl(workload: string): string | null {
  const m = workload.match(/^gke-run-test-caces-(\d+)$/);
  if (!m) return null;
  return `https://github.com/sgl-project/sglang-jax/actions/runs/${m[1]}`;
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const fullPath = path.map((p) => decodeURIComponent(p)).join("/");

  const bucket = process.env.GCS_BUCKET ?? "your-gcs-bucket-name";
  const client = await createDefaultClient(bucket);
  const result = await getDetail({ client, path: fullPath });
  if (!result.ok) notFound();
  const d = result.value;
  const runUrl = ghRunUrl(d.workload);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-[color:var(--color-accent)] hover:underline">
          ← back to dashboard
        </Link>
      </nav>
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide text-[color:var(--color-fg-muted)]">
          {d.type} case
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{d.case}</h1>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-[color:var(--color-fg-muted)]">Profile</dt>
            <dd className="font-mono text-xs">{d.profile}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-[color:var(--color-fg-muted)]">Target</dt>
            <dd className="font-mono text-xs">{d.target}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-[color:var(--color-fg-muted)]">Date</dt>
            <dd className="font-mono text-xs">{d.date}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-[color:var(--color-fg-muted)]">Workload</dt>
            <dd className="font-mono text-xs">
              {runUrl ? (
                <a
                  href={runUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--color-accent)] hover:underline"
                >
                  {d.workload}
                </a>
              ) : (
                d.workload
              )}
            </dd>
          </div>
        </dl>
      </header>

      <div className="flex flex-col gap-8">
        {d.type === "perf" ? (
          <>
            <LatencyCard d={d} />
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <ThroughputCard d={d} />
              <TokensCard d={d} />
            </div>
            <RunConfigCard d={d} />
            <SamplesCard d={d} />
            <ServerInfoCard d={d} />
          </>
        ) : (
          <>
            <AccuracyCard d={d} />
            <ExtraCard d={d} />
          </>
        )}
      </div>
    </main>
  );
}
