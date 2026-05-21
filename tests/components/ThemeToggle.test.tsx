import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "@/components/ThemeToggle";

beforeEach(() => {
  // happy-dom does not implement Storage.clear(); remove the key we care about
  try {
    localStorage.removeItem("theme");
  } catch {
    // ignore
  }
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("defaults to Auto when nothing is stored", async () => {
    render(<ThemeToggle />);
    const btn = await screen.findByRole("button");
    expect(btn.textContent).toMatch(/Auto/);
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("reads a stored theme on mount", async () => {
    localStorage.setItem("theme", "dark");
    render(<ThemeToggle />);
    const btn = await screen.findByRole("button");
    expect(btn.textContent).toMatch(/Dark/);
  });

  it("cycles Auto → Light → Dark → Auto and persists the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");

    await user.click(btn);
    expect(btn.textContent).toMatch(/Light/);
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    await user.click(btn);
    expect(btn.textContent).toMatch(/Dark/);
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    await user.click(btn);
    expect(btn.textContent).toMatch(/Auto/);
    expect(localStorage.getItem("theme")).toBeNull();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });
});
