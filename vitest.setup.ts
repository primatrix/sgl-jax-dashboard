import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// happy-dom 15.x ships an incomplete Storage that lacks getItem/setItem/clear.
// Substitute a tiny in-memory implementation so ThemeToggle and any other
// localStorage consumer behave normally under test.
class InMemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
  removeItem(key: string): void { this.store.delete(key); }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
}

vi.stubGlobal("localStorage", new InMemoryStorage());
vi.stubGlobal("sessionStorage", new InMemoryStorage());

// Without globals: true in vitest.config, RTL's automatic cleanup does not run.
// Register it manually so component state does not leak between tests.
afterEach(() => {
  cleanup();
});
