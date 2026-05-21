import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CaseTrend } from "@/components/case/CaseTrend";
import { sampleAccuracy, samplePerf } from "../../helpers/fixtures";

const tsBody = {
  case: "bench",
  profile: "p",
  target: "v6e-4x4",
  metric: "output_throughput",
  points: [
    { date: "2026-05-18", workload: "r1", value: 100, type: "perf" },
    { date: "2026-05-19", workload: "r2", value: 110, type: "perf" },
  ],
};

beforeEach(() => {
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify(tsBody), { status: 200 }),
  ) as typeof fetch;
});

describe("CaseTrend", () => {
  it("fetches the current perf case trend with the default perf metric", async () => {
    render(<CaseTrend detail={samplePerf()} />);

    await waitFor(() => {
      const calls = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map(
        (c) => c[0],
      );
      expect(calls[0]).toContain("/api/timeseries?");
      expect(calls[0]).toContain("case=bench");
      expect(calls[0]).toContain("profile=p");
      expect(calls[0]).toContain("target=v6e-4x4");
      expect(calls[0]).toContain("metric=output_throughput");
    });
  });

  it("uses score as the accuracy trend metric", async () => {
    render(<CaseTrend detail={sampleAccuracy()} />);

    await waitFor(() => {
      const calls = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map(
        (c) => c[0],
      );
      expect(calls[0]).toContain("case=gsm8k");
      expect(calls[0]).toContain("metric=score");
    });
  });

  it("shows a scoped trend heading on the detail page", async () => {
    render(<CaseTrend detail={samplePerf()} />);
    expect(screen.getByRole("heading", { name: "Trend" })).toBeInTheDocument();
  });
});
