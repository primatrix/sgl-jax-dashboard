import { getMetric, type CaseSummary, type Metric } from "./types";

export type Selector = { case: string; profile: string; target: string };

function sameSelector(c: CaseSummary, s: Selector): boolean {
  return c.case === s.case && c.profile === s.profile && c.target === s.target;
}

export type Comparison = {
  // Previous run of the same selector (immediately before `current` in time).
  previous: number | null;
  // Signed relative change (current - previous) / previous. null if no prev.
  delta: number | null;
  // Full history of this metric for this selector, time-ASCENDING. Used for
  // sparklines so the line ends at the most recent point on the right.
  history: number[];
};

export function compareMetric(
  cases: CaseSummary[],
  current: CaseSummary,
  metric: Metric,
): Comparison {
  const sel: Selector = {
    case: current.case,
    profile: current.profile,
    target: current.target,
  };

  // Collect all matching cases with a numeric value for this metric, sorted
  // by (date asc, updated asc) so history reads left→right oldest→newest.
  const all = cases
    .filter((c) => sameSelector(c, sel))
    .filter((c) => {
      const v = getMetric(c, metric);
      return typeof v === "number" && Number.isFinite(v);
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.updated < b.updated ? -1 : 1;
    });

  const history = all.map((c) => getMetric(c, metric) as number);

  // Find current's position in the sorted list; previous = the one before.
  const idx = all.findIndex((c) => c.path === current.path);
  let previous: number | null = null;
  if (idx > 0) {
    previous = history[idx - 1];
  }

  const currentValue = getMetric(current, metric);
  let delta: number | null = null;
  if (previous !== null && previous !== 0 && typeof currentValue === "number") {
    delta = (currentValue - previous) / previous;
  }

  return { previous, delta, history };
}
