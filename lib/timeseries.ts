import {
  getMetric,
  isPerfSummary,
  metricsForType,
  type CaseSummary,
  type Metric,
  type TimeseriesResponse,
} from "./types";

export type TimeseriesSelector = {
  case: string;
  profile: string;
  target: string;
};

export function buildTimeseries(
  cases: CaseSummary[],
  sel: TimeseriesSelector,
  metric?: Metric,
): TimeseriesResponse {
  const matching = cases.filter(
    (c) => c.case === sel.case && c.profile === sel.profile && c.target === sel.target,
  );
  if (matching.length === 0) {
    throw new Error(
      `no cases match selector case=${sel.case} profile=${sel.profile} target=${sel.target}`,
    );
  }
  const isPerf = isPerfSummary(matching[0]);
  const m: Metric = metric ?? (isPerf ? "output_throughput" : "score");

  const allowed = metricsForType(isPerf ? "perf" : "accuracy");
  if (!allowed.includes(m)) {
    throw new Error(
      `metric ${m} is not applicable to ${isPerf ? "perf" : "accuracy"} cases`,
    );
  }

  const points = matching
    .map((c) => {
      const v = getMetric(c, m);
      if (v === undefined) return null;
      return {
        date: c.date,
        workload: c.workload,
        value: v,
        type: c.type,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    case: sel.case,
    profile: sel.profile,
    target: sel.target,
    metric: m,
    points,
  };
}

// Convenience: enumerate every unique (case, profile, target) triple in a list.
export function listSelectors(cases: CaseSummary[]): TimeseriesSelector[] {
  const seen = new Map<string, TimeseriesSelector>();
  for (const c of cases) {
    const key = `${c.case}|${c.profile}|${c.target}`;
    if (!seen.has(key)) {
      seen.set(key, { case: c.case, profile: c.profile, target: c.target });
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.case === b.case ? a.profile.localeCompare(b.profile) : a.case.localeCompare(b.case),
  );
}

// Determine the type of a selector by looking it up in the case list.
// Used by the UI to decide which metrics to offer.
export function selectorType(
  cases: CaseSummary[],
  sel: TimeseriesSelector,
): "perf" | "accuracy" | undefined {
  const match = cases.find(
    (c) => c.case === sel.case && c.profile === sel.profile && c.target === sel.target,
  );
  if (!match) return undefined;
  return match.type;
}
