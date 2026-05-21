import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { samplePerf } from "../../helpers/fixtures";

const casesBody = {
  cases: [samplePerf({ workload: "gke-run-test-caces-1", path: "p1" })],
  errors: [],
};

const tsBody = {
  case: "bench",
  profile: "p",
  target: "v6e-4x4",
  metric: "output_throughput",
  points: [{ date: "2026-05-18", workload: "r1", value: 100, type: "perf" }],
};

beforeEach(() => {
  global.fetch = vi.fn(async (input: RequestInfo) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/cases"))
      return new Response(JSON.stringify(casesBody), { status: 200 });
    if (url.startsWith("/api/timeseries"))
      return new Response(JSON.stringify(tsBody), { status: 200 });
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
});

describe("Dashboard", () => {
  it("loads cases and renders the table", async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText("bench")).toBeInTheDocument());
  });

  it("loads a timeseries for the first selector by default", async () => {
    render(<Dashboard />);
    await waitFor(() => {
      const calls = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map(
        (c) => c[0],
      );
      expect(calls.some((u) => u.includes("/api/timeseries?case=bench"))).toBe(true);
    });
  });

  it("renders an error banner if /api/cases returns 503", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "auth bad" }), { status: 503 }),
    ) as typeof fetch;
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("changing the selector triggers a new timeseries fetch", async () => {
    const twoCases = {
      cases: [
        samplePerf({ workload: "gke-run-test-caces-1", path: "p1" }),
        samplePerf({ case: "other", workload: "gke-run-test-caces-1", path: "p2" }),
      ],
      errors: [],
    };
    global.fetch = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/cases"))
        return new Response(JSON.stringify(twoCases), { status: 200 });
      return new Response(JSON.stringify(tsBody), { status: 200 });
    }) as typeof fetch;

    const user = userEvent.setup();
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText("bench")).toBeInTheDocument();
      expect(screen.getByText("other")).toBeInTheDocument();
    });
    const selectorCombo = screen.getAllByRole("combobox").find(
      (el) => (el as HTMLSelectElement).value.includes("|"),
    ) as HTMLSelectElement;
    await user.selectOptions(selectorCombo, "other|p|v6e-4x4");
    await waitFor(() => {
      const calls = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map((c) => c[0]);
      expect(calls.some((u) => u.includes("case=other"))).toBe(true);
    });
  });
});
