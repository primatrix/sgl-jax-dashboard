"use client";

import { useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "theme";

function applyTheme(theme: Theme): void {
  const html = document.documentElement;
  if (theme === "system") {
    html.removeAttribute("data-theme");
  } else {
    html.setAttribute("data-theme", theme);
  }
}

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // localStorage may throw in private windows / restricted contexts
  }
  return "system";
}

function nextTheme(t: Theme): Theme {
  return t === "system" ? "light" : t === "light" ? "dark" : "system";
}

function label(t: Theme): string {
  return t === "system" ? "Auto" : t === "light" ? "Light" : "Dark";
}

function icon(t: Theme): string {
  return t === "system" ? "◐" : t === "light" ? "☀" : "☾";
}

export function ThemeToggle() {
  // SSR-safe default; corrected on mount.
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    setThemeState(readStored());
  }, []);

  const cycle = () => {
    const next = nextTheme(theme);
    setThemeState(next);
    try {
      if (next === "system") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // ignore storage failures; in-memory state still updates
    }
    applyTheme(next);
  };

  const text = `${icon(theme)} ${label(theme)}`;
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Theme: ${label(theme)}. Click to change.`}
      title={`Theme: ${label(theme)} (click to cycle)`}
      className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-bg-elev)] px-2 py-1 text-xs font-mono text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)]"
    >
      {text}
    </button>
  );
}
