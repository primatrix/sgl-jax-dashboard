type Props = {
  // Score in [0,1]
  score: number;
};

// A horizontal progress bar + percent label. Color buckets:
//   >= 0.95  → ok (green)
//   >= 0.80  → accent (blue)
//   <  0.80  → warn (amber)
export function ScoreBar({ score }: Props) {
  const pct = Math.max(0, Math.min(1, score)) * 100;
  const color =
    score >= 0.95
      ? "var(--color-ok)"
      : score >= 0.8
        ? "var(--color-accent)"
        : "var(--color-warn)";
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className="inline-block w-20 overflow-hidden rounded bg-[color:var(--color-bg-elev)]"
        style={{ height: 6 }}
        aria-hidden
      >
        <span
          className="block h-full rounded"
          style={{ width: `${pct}%`, background: color }}
        />
      </span>
      <span className="font-mono tabular-nums" style={{ color }}>
        {pct.toFixed(2)}%
      </span>
    </div>
  );
}
