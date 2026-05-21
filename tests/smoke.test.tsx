import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

describe("test harness smoke", () => {
  it("renders a React tree", () => {
    render(<div data-testid="hello">hi</div>);
    expect(screen.getByTestId("hello")).toHaveTextContent("hi");
  });
});
