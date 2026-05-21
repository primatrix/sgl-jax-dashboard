"use client";

import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { TimeseriesResponse } from "@/lib/types";

export function TimeSeriesChart({ series }: { series: TimeseriesResponse }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || series.points.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    chartRef.current?.destroy();
    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: series.points.map((p) => p.date),
        datasets: [
          {
            label: `${series.case} · ${series.metric}`,
            data: series.points.map((p) => p.value),
            borderColor: "#60a5fa",
            backgroundColor: "rgba(96,165,250,0.18)",
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(127,127,127,0.18)" } },
          y: { grid: { color: "rgba(127,127,127,0.18)" }, beginAtZero: false },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [series]);

  if (series.points.length === 0) {
    return (
      <p className="text-[color:var(--color-fg-muted)] py-6">No data for this selector.</p>
    );
  }
  return (
    <div className="relative h-72 w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
