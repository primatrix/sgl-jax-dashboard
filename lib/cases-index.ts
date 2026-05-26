import type { GcsClient } from "./gcs";
import { isCaseObjectName, parseCaseSummary } from "./parse";
import {
  CASES_INDEX_VERSION,
  type CasesIndex,
  type CaseSummary,
  type ParseError,
} from "./types";

const INDEX_PREFIX = "_indexes/";

export function indexObjectName(date: string): string {
  return `${INDEX_PREFIX}${date}.json`;
}

export function isIndexObjectName(name: string): boolean {
  return name.startsWith(INDEX_PREFIX);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function recentDates(now: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(ymd(d));
  }
  return out;
}

// Read a per-day aggregated index. Returns null if the object is missing,
// malformed, or written by a different schema version. Callers should treat
// null as "rebuild this day from the raw case files."
export async function readIndex(
  client: GcsClient,
  date: string,
): Promise<CasesIndex | null> {
  const body = await client.tryGetObject(indexObjectName(date));
  if (body === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== CASES_INDEX_VERSION) return null;
  if (obj.date !== date) return null;
  if (typeof obj.built_at !== "string") return null;
  if (!Array.isArray(obj.cases) || !Array.isArray(obj.errors)) return null;
  return {
    version: CASES_INDEX_VERSION,
    date,
    built_at: obj.built_at,
    cases: obj.cases as CaseSummary[],
    errors: obj.errors as ParseError[],
  };
}

export async function writeIndex(
  client: GcsClient,
  index: CasesIndex,
): Promise<void> {
  await client.putObject(indexObjectName(index.date), JSON.stringify(index));
}

// Build a fresh index for a single date by listing the date prefix, downloading
// every case file, and reducing each to a summary. Cost: O(K) GCS GETs where K
// is the number of case files for that date. Intended for cache-miss recovery
// and scheduled rebuilds of today's index.
export async function buildIndexForDate(
  client: GcsClient,
  date: string,
  now: Date = new Date(),
): Promise<CasesIndex> {
  const prefix = `${date}/`;
  const metas = (await client.listObjects(prefix)).filter((m) =>
    isCaseObjectName(m.name),
  );
  const bodies = await Promise.all(metas.map((m) => client.getObject(m.name)));
  const cases: CaseSummary[] = [];
  const errors: ParseError[] = [];
  metas.forEach((m, i) => {
    const r = parseCaseSummary(bodies[i], { path: m.name, updated: m.updated });
    if (r.ok) cases.push(r.value);
    else errors.push(r.error);
  });
  return {
    version: CASES_INDEX_VERSION,
    date,
    built_at: now.toISOString(),
    cases,
    errors,
  };
}

// True iff today's index is older than `maxAgeMs`. Pure helper so callers can
// decide between "serve stale" and "synchronously rebuild" without re-reading
// the index.
export function isIndexStale(
  index: CasesIndex,
  now: Date,
  maxAgeMs: number,
): boolean {
  const builtAt = Date.parse(index.built_at);
  if (Number.isNaN(builtAt)) return true;
  return now.getTime() - builtAt > maxAgeMs;
}

/* ---------- aggregated read path ---------- */

export type ListCasesOptions = {
  client: GcsClient;
  days: number;
  now?: Date;
};

// Read N days of cases via the per-day index. On cache miss for a given date,
// rebuild that day's index from raw GCS objects and write it back so subsequent
// reads (and other instances) skip the O(K) download. Today's index is trusted
// even if mildly stale; the scheduled rebuild owns freshness.
export async function listCases(opts: ListCasesOptions): Promise<{
  cases: CaseSummary[];
  errors: ParseError[];
}> {
  const now = opts.now ?? new Date();
  const dates = recentDates(now, opts.days);

  const indexes = await Promise.all(
    dates.map((date) => loadIndex(opts.client, date, now)),
  );

  const cases: CaseSummary[] = [];
  const errors: ParseError[] = [];
  for (const idx of indexes) {
    cases.push(...idx.cases);
    errors.push(...idx.errors);
  }

  cases.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.updated < b.updated ? 1 : -1;
  });

  return { cases, errors };
}

async function loadIndex(
  client: GcsClient,
  date: string,
  now: Date,
): Promise<CasesIndex> {
  const cached = await readIndex(client, date);
  if (cached) return cached;
  const built = await buildIndexForDate(client, date, now);
  try {
    await writeIndex(client, built);
  } catch {
    // best-effort: missing write permission or eventual-consistency hiccup
    // should not break the user-facing read path.
  }
  return built;
}
