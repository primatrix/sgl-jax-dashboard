import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CasesTable } from "@/components/dashboard/CasesTable";
import { samplePerf, sampleAccuracy } from "../../helpers/fixtures";

const perf = samplePerf();
const acc = sampleAccuracy();

describe("CasesTable", () => {
  it("renders the visible perf columns: ttft / itl / e2e / output_throughput", () => {
    render(<CasesTable cases={[perf]} />);
    expect(screen.getByText(/Performance/i)).toBeInTheDocument();
    expect(screen.getByText("bench")).toBeInTheDocument();
    expect(screen.getByText("v6e-4x4")).toBeInTheDocument();
    expect(screen.getByText("84.48s")).toBeInTheDocument(); // ttft median
    expect(screen.getByText("24.1ms")).toBeInTheDocument(); // itl median
    expect(screen.getByText("1.00s")).toBeInTheDocument();  // e2e median
    expect(screen.getByText("339.7")).toBeInTheDocument();  // output thpt
  });

  it("does NOT render columns moved to the detail page (completed, p99s, total_throughput, req/s)", () => {
    render(<CasesTable cases={[perf]} />);
    expect(screen.queryByText("256")).toBeNull();           // completed
    expect(screen.queryByText("5775.0")).toBeNull();        // total_throughput
    expect(screen.queryByText("0.33")).toBeNull();          // request_throughput
  });

  it("case name is a link to the detail page", () => {
    render(<CasesTable cases={[perf]} />);
    const caseLink = screen.getByRole("link", { name: /bench/ }) as HTMLAnchorElement;
    expect(caseLink.getAttribute("href")).toBe(
      "/case/" + perf.path.split("/").map(encodeURIComponent).join("/"),
    );
  });

  it("renders an Accuracy section with score as percent and dataset", () => {
    render(<CasesTable cases={[acc]} />);
    expect(screen.getByText(/Accuracy/i)).toBeInTheDocument();
    expect(screen.getAllByText("gsm8k")).toHaveLength(2);   // case + dataset
    expect(screen.getByText("95.00%")).toBeInTheDocument();
  });

  it("renders both sections when both kinds of cases are present", () => {
    render(<CasesTable cases={[perf, acc]} />);
    expect(screen.getByText(/Performance/i)).toBeInTheDocument();
    expect(screen.getByText(/Accuracy/i)).toBeInTheDocument();
  });

  it("omits the section when no cases of that type exist", () => {
    render(<CasesTable cases={[acc]} />);
    expect(screen.queryByText(/Performance/i)).toBeNull();
  });

  it("shortens long workload IDs to the run number and points at the GH run URL", () => {
    render(<CasesTable cases={[perf]} />);
    // workload "gke-run-test-caces-12345" → run id "12345"
    const link = screen.getByRole("link", { name: "12345" }) as HTMLAnchorElement;
    expect(link.href).toContain("/sgl-project/sglang-jax/actions/runs/12345");
    expect(link.getAttribute("title")).toBe("gke-run-test-caces-12345");
  });

  it("renders an empty-state message when cases is []", () => {
    render(<CasesTable cases={[]} />);
    expect(screen.getByText(/no cases/i)).toBeInTheDocument();
  });

  it("does not dedupe across types", () => {
    render(
      <CasesTable
        cases={[perf, acc, samplePerf({ path: "x2" })]}
      />,
    );
    const perfSection = screen.getByText(/Performance/i).closest("section")!;
    expect(within(perfSection).getAllByRole("row")).toHaveLength(3); // header + 2 perf
  });

  it("does not show an approximate marker for tiny perf changes", () => {
    render(
      <CasesTable
        cases={[
          samplePerf({ date: "2026-05-18", path: "old", output_throughput: 339.7 }),
          samplePerf({ date: "2026-05-19", path: "new", output_throughput: 339.71 }),
        ]}
      />,
    );

    expect(screen.queryByText("≈")).not.toBeInTheDocument();
  });

  it("colors performance improvements red and regressions green", () => {
    render(
      <CasesTable
        cases={[
          samplePerf({
            date: "2026-05-18",
            path: "old",
            median_ttft_ms: 1000,
            output_throughput: 100,
          }),
          samplePerf({
            date: "2026-05-19",
            path: "new",
            median_ttft_ms: 900,
            output_throughput: 110,
          }),
        ]}
      />,
    );

    expect(screen.getByTitle("-10.00% vs previous run").getAttribute("style")).toContain(
      "var(--color-danger)",
    );
    expect(screen.getByTitle("10.00% vs previous run").getAttribute("style")).toContain(
      "var(--color-danger)",
    );
  });

  it("colors accuracy score improvements red and regressions green", () => {
    render(
      <CasesTable
        cases={[
          sampleAccuracy({ date: "2026-05-18", path: "old-acc", score: 0.9 }),
          sampleAccuracy({ date: "2026-05-19", path: "new-acc", score: 0.99 }),
        ]}
      />,
    );

    expect(screen.getByTitle("10.00% vs previous run").getAttribute("style")).toContain(
      "var(--color-danger)",
    );
  });
});
