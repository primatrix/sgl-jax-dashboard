type Props = {
  // Signed relative change, e.g. 0.021 = +2.1%
  delta: number | null;
  // If true, a NEGATIVE delta is green and a POSITIVE delta is red.
  // Default false keeps score-style behavior: positive green, negative red.
  lowerBetter?: boolean;
  // Minimum |delta| to render. Below this we keep the cell quiet.
  threshold?: number;
  betterColor?: string;
  worseColor?: string;
};

export function DeltaBadge({
  delta,
  lowerBetter = false,
  threshold = 0.001,
  betterColor = "var(--color-ok)",
  worseColor = "var(--color-danger)",
}: Props) {
  if (delta === null) return null; // no previous run
  if (Math.abs(delta) < threshold) return null;
  const better = lowerBetter ? delta < 0 : delta > 0;
  const color = better ? betterColor : worseColor;
  const arrow = delta > 0 ? "↑" : "↓";
  return (
    <span
      className="ml-1 text-[10px] font-mono tabular-nums"
      style={{ color }}
      title={`${(delta * 100).toFixed(2)}% vs previous run`}
    >
      {arrow}
      {(Math.abs(delta) * 100).toFixed(1)}%
    </span>
  );
}
