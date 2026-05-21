import Link from "next/link";
import {
  isAccuracySummary,
  isLowerBetter,
  isPerfSummary,
  type AccuracySummary,
  type CaseSummary,
  type PerfSummary,
} from "@/lib/types";
import { compareMetric } from "@/lib/compare";
import { DeltaBadge } from "@/components/ui/DeltaBadge";
import { ScoreBar } from "@/components/ui/ScoreBar";

function ghRunUrl(workload: string): string | null {
  const m = workload.match(/^gke-run-test-caces-(\d+)$/);
  if (!m) return null;
  return `https://github.com/sgl-project/sglang-jax/actions/runs/${m[1]}`;
}

// Extract the run ID (numeric suffix). Falls back to full string if shape
// is unexpected.
function runId(workload: string): string {
  const m = workload.match(/-(\d+)$/);
  return m ? m[1] : workload;
}

function caseDetailHref(path: string): string {
  return "/case/" + path.split("/").map(encodeURIComponent).join("/");
}

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(1)}ms`;
}

function fmtNum(n: number): string {
  if (Math.abs(n) >= 100) return n.toFixed(1);
  return n.toFixed(2);
}

function RunCell({ workload }: { workload: string }) {
  const url = ghRunUrl(workload);
  const id = runId(workload);
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={workload}
      className="font-mono text-xs text-[color:var(--color-accent)] hover:underline"
    >
      {id}
    </a>
  ) : (
    <span title={workload} className="font-mono text-xs">{id}</span>
  );
}

function CaseCell({ c }: { c: CaseSummary }) {
  return (
    <Link
      href={caseDetailHref(c.path)}
      className="inline-flex items-center gap-1 font-medium text-[color:var(--color-accent)] underline decoration-dotted underline-offset-4 hover:decoration-solid"
      title="View full details"
    >
      {c.case}
      <span aria-hidden className="text-xs">›</span>
    </Link>
  );
}

const TH = "px-3 py-2 font-medium whitespace-nowrap";
const TD = "px-3 py-2 align-middle";
const TD_NUM = `${TD} text-right font-mono tabular-nums whitespace-nowrap`;
const DELTA_THRESHOLD = 0.001;
const IMPROVED_COLOR = "var(--color-danger)";
const REGRESSED_COLOR = "var(--color-ok)";

function deltaColor(
  delta: number | null,
  lowerBetter: boolean,
  betterColor: string,
  worseColor: string,
): string | undefined {
  if (delta === null || Math.abs(delta) < DELTA_THRESHOLD) return undefined;
  const better = lowerBetter ? delta < 0 : delta > 0;
  return better ? betterColor : worseColor;
}

function NumCell({
  formatted,
  delta,
  lowerBetter,
  betterColor = "var(--color-ok)",
  worseColor = "var(--color-danger)",
}: {
  formatted: string;
  delta: number | null;
  lowerBetter: boolean;
  betterColor?: string;
  worseColor?: string;
}) {
  const color = deltaColor(delta, lowerBetter, betterColor, worseColor);
  return (
    <span className="inline-flex items-baseline">
      <span style={color ? { color } : undefined}>{formatted}</span>
      <DeltaBadge
        delta={delta}
        lowerBetter={lowerBetter}
        threshold={DELTA_THRESHOLD}
        betterColor={betterColor}
        worseColor={worseColor}
      />
    </span>
  );
}

const CHANGE_COLORS = {
  betterColor: IMPROVED_COLOR,
  worseColor: REGRESSED_COLOR,
};

/* ---------- Perf ---------- */

function PerfRow({ c, all }: { c: PerfSummary; all: CaseSummary[] }) {
  const ttftMed = compareMetric(all, c, "median_ttft_ms");
  const itlMed = compareMetric(all, c, "median_itl_ms");
  const e2eMed = compareMetric(all, c, "median_e2e_latency_ms");
  const outThp = compareMetric(all, c, "output_throughput");

  return (
    <tr className="border-t border-[color:var(--color-border)]">
      <td className={`${TD} font-mono text-xs whitespace-nowrap`}>{c.date}</td>
      <td className={TD}>
        <RunCell workload={c.workload} />
      </td>
      <td className={TD}>
        <CaseCell c={c} />
      </td>
      <td className={`${TD} font-mono text-xs`}>{c.target}</td>
      <td className={TD_NUM}>
        <NumCell
          formatted={fmtMs(c.median_ttft_ms)}
          delta={ttftMed.delta}
          lowerBetter={isLowerBetter("median_ttft_ms")}
          {...CHANGE_COLORS}
        />
      </td>
      <td className={TD_NUM}>
        <NumCell
          formatted={fmtMs(c.median_itl_ms)}
          delta={itlMed.delta}
          lowerBetter={isLowerBetter("median_itl_ms")}
          {...CHANGE_COLORS}
        />
      </td>
      <td className={TD_NUM}>
        <NumCell
          formatted={fmtMs(c.median_e2e_latency_ms)}
          delta={e2eMed.delta}
          lowerBetter={isLowerBetter("median_e2e_latency_ms")}
          {...CHANGE_COLORS}
        />
      </td>
      <td className={TD_NUM}>
        <NumCell
          formatted={fmtNum(c.output_throughput)}
          delta={outThp.delta}
          lowerBetter={isLowerBetter("output_throughput")}
          {...CHANGE_COLORS}
        />
      </td>
    </tr>
  );
}

function PerfTable({ all, cases }: { all: CaseSummary[]; cases: PerfSummary[] }) {
  if (cases.length === 0) return null;
  return (
    <section>
      <header className="flex items-baseline justify-between pb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-fg-muted)]">
          Performance · {cases.length}
        </h3>
        <p className="text-xs text-[color:var(--color-fg-muted)]">
          Click case name for all fields
        </p>
      </header>
      <div className="overflow-x-auto rounded border border-[color:var(--color-border)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[color:var(--color-bg-elev)] text-left text-[color:var(--color-fg-muted)]">
            <tr>
              <th className={TH}>Date</th>
              <th className={TH}>Run</th>
              <th className={TH}>Case</th>
              <th className={TH}>TPU</th>
              <th className={`${TH} text-right`}>TTFT med</th>
              <th className={`${TH} text-right`}>ITL med</th>
              <th className={`${TH} text-right`}>E2E med</th>
              <th className={`${TH} text-right`}>Out tok/s</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <PerfRow key={c.path} c={c} all={all} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- Accuracy ---------- */

function AccuracyRow({ c, all }: { c: AccuracySummary; all: CaseSummary[] }) {
  const cmp = compareMetric(all, c, "score");
  return (
    <tr className="border-t border-[color:var(--color-border)]">
      <td className={`${TD} font-mono text-xs whitespace-nowrap`}>{c.date}</td>
      <td className={TD}>
        <RunCell workload={c.workload} />
      </td>
      <td className={TD}>
        <CaseCell c={c} />
      </td>
      <td className={`${TD} font-mono text-xs`}>{c.target}</td>
      <td className={TD}>{c.dataset}</td>
      <td className={TD}>
        <span className="inline-flex items-baseline gap-1">
          <ScoreBar score={c.score} />
          <DeltaBadge delta={cmp.delta} lowerBetter={false} {...CHANGE_COLORS} />
        </span>
      </td>
    </tr>
  );
}

function AccuracyTable({ all, cases }: { all: CaseSummary[]; cases: AccuracySummary[] }) {
  if (cases.length === 0) return null;
  return (
    <section>
      <header className="flex items-baseline justify-between pb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-fg-muted)]">
          Accuracy · {cases.length}
        </h3>
        <p className="text-xs text-[color:var(--color-fg-muted)]">
          Δ vs previous run of same case · click case name for all fields
        </p>
      </header>
      <div className="overflow-x-auto rounded border border-[color:var(--color-border)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[color:var(--color-bg-elev)] text-left text-[color:var(--color-fg-muted)]">
            <tr>
              <th className={TH}>Date</th>
              <th className={TH}>Run</th>
              <th className={TH}>Case</th>
              <th className={TH}>TPU</th>
              <th className={TH}>Dataset</th>
              <th className={TH}>Score</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <AccuracyRow key={c.path} c={c} all={all} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- Top-level ---------- */

export function CasesTable({ cases }: { cases: CaseSummary[] }) {
  if (cases.length === 0) {
    return (
      <p className="text-[color:var(--color-fg-muted)] py-6">
        No cases in the selected window.
      </p>
    );
  }
  const perf = cases.filter(isPerfSummary);
  const accuracy = cases.filter(isAccuracySummary);
  return (
    <div className="flex flex-col gap-6">
      <PerfTable all={cases} cases={perf} />
      <AccuracyTable all={cases} cases={accuracy} />
    </div>
  );
}
