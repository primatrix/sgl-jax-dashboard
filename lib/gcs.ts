import type { CaseDetail, CaseSummary, ParseError } from "./types";
import {
  isCaseObjectName,
  parseCaseDetail,
  parseCaseSummary,
} from "./parse";

export type GcsObjectMeta = { name: string; updated: string };

export interface GcsClient {
  listObjects(prefix: string): Promise<GcsObjectMeta[]>;
  getObject(name: string): Promise<string>;
  // For single-object detail fetches we also want object metadata (updated).
  statObject(name: string): Promise<GcsObjectMeta>;
}

export type ListCasesOptions = {
  client: GcsClient;
  days: number;
  now?: Date;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function recentDatePrefixes(now: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(ymd(d) + "/");
  }
  return out;
}

export async function listCases(opts: ListCasesOptions): Promise<{
  cases: CaseSummary[];
  errors: ParseError[];
}> {
  const now = opts.now ?? new Date();
  const prefixes = recentDatePrefixes(now, opts.days);

  const metaLists = await Promise.all(prefixes.map((p) => opts.client.listObjects(p)));
  const metas: GcsObjectMeta[] = ([] as GcsObjectMeta[])
    .concat(...metaLists)
    .filter((m) => isCaseObjectName(m.name));

  const bodies = await Promise.all(metas.map((m) => opts.client.getObject(m.name)));

  const cases: CaseSummary[] = [];
  const errors: ParseError[] = [];
  metas.forEach((m, i) => {
    const r = parseCaseSummary(bodies[i], { path: m.name, updated: m.updated });
    if (r.ok) cases.push(r.value);
    else errors.push(r.error);
  });

  cases.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.updated < b.updated ? 1 : -1;
  });

  return { cases, errors };
}

export type GetDetailOptions = {
  client: GcsClient;
  path: string; // full object name, e.g. 2026-05-19/run-1/foo.json
};

export async function getDetail(
  opts: GetDetailOptions,
): Promise<{ ok: true; value: CaseDetail } | { ok: false; error: ParseError }> {
  if (!isCaseObjectName(opts.path)) {
    return { ok: false, error: { path: opts.path, reason: "bad path shape" } };
  }
  const meta = await opts.client.statObject(opts.path);
  const body = await opts.client.getObject(opts.path);
  return parseCaseDetail(body, { path: opts.path, updated: meta.updated });
}

/* ---------- production factory ---------- */

export async function createDefaultClient(bucket: string): Promise<GcsClient> {
  const { Storage } = await import("@google-cloud/storage");
  const storage = new Storage();
  const b = storage.bucket(bucket);
  return {
    async listObjects(prefix: string): Promise<GcsObjectMeta[]> {
      const [files] = await b.getFiles({ prefix, autoPaginate: true });
      return files.map((f) => ({
        name: f.name,
        updated: (f.metadata?.updated as string) ?? new Date().toISOString(),
      }));
    },
    async getObject(name: string): Promise<string> {
      const [buf] = await b.file(name).download();
      return buf.toString("utf8");
    },
    async statObject(name: string): Promise<GcsObjectMeta> {
      const [md] = await b.file(name).getMetadata();
      return {
        name,
        updated: (md.updated as string) ?? new Date().toISOString(),
      };
    },
  };
}
