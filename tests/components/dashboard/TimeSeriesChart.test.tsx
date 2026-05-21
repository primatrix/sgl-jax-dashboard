import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { TimeSeriesChart } from "@/components/dashboard/TimeSeriesChart";

// Stub Chart.js so we don't depend on canvas rendering in happy-dom.
vi.mock("chart.js/auto", () => {
  return {
    default: class {
      constructor(public ctx: unknown, public cfg: { data: { datasets: [{ data: number[] }] } }) {}
      update = vi.fn();
      destroy = vi.fn();
      data: { datasets: [{ data: number[] }] } = { datasets: [{ data: [] }] };
    },
  };
});

describe("TimeSeriesChart", () => {
  it("renders a canvas element", () => {
    const { container } = render(
      <TimeSeriesChart
        series={{
          case: "bench",
          profile: "p",
          target: "v6e-4x4",
          metric: "output_throughput",
          points: [
            { date: "2026-05-17", workload: "r1", value: 100, type: "perf" },
            { date: "2026-05-18", workload: "r2", value: 200, type: "perf" },
          ],
        }}
      />,
    );
    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("renders empty-state when points is []", () => {
    const { container, getByText } = render(
      <TimeSeriesChart
        series={{
          case: "bench",
          profile: "p",
          target: "v6e-4x4",
          metric: "output_throughput",
          points: [],
        }}
      />,
    );
    expect(container.querySelector("canvas")).toBeNull();
    expect(getByText(/no data/i)).toBeInTheDocument();
  });
});
