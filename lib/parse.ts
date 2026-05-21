import type {
  AccuracyDetail,
  CaseDetail,
  CaseMeta,
  CaseSummary,
  ParseError,
  PerfDetail,
  PerfSamples,
} from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseObjectPath(name: string): {
  date: string;
  workload: string;
  basename: string;
} | null {
  if (name.endsWith("/")) return null;
  const parts = name.split("/");
  if (parts.length !== 3) return null;
  const [date, workload, basename] = parts;
  if (!DATE_RE.test(date)) return null;
  if (!workload) return null;
  return { date, workload, basename };
}

export function isCaseObjectName(name: string): boolean {
  if (!name.endsWith(".json")) return false;
  return parseObjectPath(name) !== null;
}

/* ---------- coercion helpers ---------- */

function num(v: unknown, dflt = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : dflt;
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function strOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function arrOf<T>(v: unknown, map: (x: unknown) => T): T[] {
  return Array.isArray(v) ? v.map(map) : [];
}

/* ---------- detail parse (full body) ---------- */

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ParseError };

export function parseCaseDetail(
  body: string,
  meta: { path: string; updated: string },
): ParseResult<CaseDetail> {
  const parsed = parseObjectPath(meta.path);
  if (!parsed) {
    return { ok: false, error: { path: meta.path, reason: "bad path" } };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch (e) {
    return {
      ok: false,
      error: { path: meta.path, reason: `invalid JSON: ${(e as Error).message}` },
    };
  }
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: { path: meta.path, reason: "not an object" } };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.type !== "perf" && obj.type !== "accuracy") {
    return { ok: false, error: { path: meta.path, reason: "missing or invalid type" } };
  }
  const common = {
    case: String(obj.case ?? ""),
    profile: String(obj.profile ?? ""),
    target: String(obj.target ?? ""),
    date: parsed.date,
    workload: parsed.workload,
    path: meta.path,
    updated: meta.updated,
  };
  if (obj.type === "perf") return { ok: true, value: parsePerfDetail(common, obj) };
  return { ok: true, value: parseAccuracyDetail(common, obj) };
}

function parsePerfDetail(
  common: CaseMeta,
  obj: Record<string, unknown>,
): PerfDetail {
  const samples: PerfSamples = {
    errors: arrOf(obj.errors, (x) => (typeof x === "string" ? x : String(x ?? ""))),
    generated_texts: arrOf(obj.generated_texts, (x) => (typeof x === "string" ? x : String(x ?? ""))),
    input_lens: arrOf(obj.input_lens, (x) => num(x)),
    output_lens: arrOf(obj.output_lens, (x) => num(x)),
    ttfts: arrOf(obj.ttfts, (x) => num(x)),
    itls: arrOf(obj.itls, (x) => (Array.isArray(x) ? x.map((y) => num(y)) : [])),
  };
  const server_info =
    obj.server_info && typeof obj.server_info === "object"
      ? (obj.server_info as Record<string, unknown>)
      : {};

  return {
    ...common,
    type: "perf",
    completed: num(obj.completed),
    // latency: ttft
    mean_ttft_ms: num(obj.mean_ttft_ms),
    median_ttft_ms: num(obj.median_ttft_ms),
    std_ttft_ms: num(obj.std_ttft_ms),
    p99_ttft_ms: num(obj.p99_ttft_ms),
    // latency: itl
    mean_itl_ms: num(obj.mean_itl_ms),
    median_itl_ms: num(obj.median_itl_ms),
    std_itl_ms: num(obj.std_itl_ms),
    p95_itl_ms: num(obj.p95_itl_ms),
    p99_itl_ms: num(obj.p99_itl_ms),
    // latency: tpot
    mean_tpot_ms: num(obj.mean_tpot_ms),
    median_tpot_ms: num(obj.median_tpot_ms),
    std_tpot_ms: num(obj.std_tpot_ms),
    p99_tpot_ms: num(obj.p99_tpot_ms),
    // latency: e2e
    mean_e2e_latency_ms: num(obj.mean_e2e_latency_ms),
    median_e2e_latency_ms: num(obj.median_e2e_latency_ms),
    std_e2e_latency_ms: num(obj.std_e2e_latency_ms),
    p90_e2e_latency_ms: num(obj.p90_e2e_latency_ms),
    p99_e2e_latency_ms: num(obj.p99_e2e_latency_ms),
    // throughput
    input_throughput: num(obj.input_throughput),
    output_throughput: num(obj.output_throughput),
    request_throughput: num(obj.request_throughput),
    total_throughput: num(obj.total_throughput),
    max_output_tokens_per_s: num(obj.max_output_tokens_per_s),
    // tokens
    total_input_tokens: num(obj.total_input_tokens),
    total_input_text_tokens: num(obj.total_input_text_tokens),
    total_input_vision_tokens: num(obj.total_input_vision_tokens),
    total_output_tokens: num(obj.total_output_tokens),
    total_output_tokens_retokenized: num(obj.total_output_tokens_retokenized),
    // run config
    backend: strOrNull(obj.backend),
    dataset_name: strOrNull(obj.dataset_name),
    duration: num(obj.duration),
    concurrency: num(obj.concurrency),
    max_concurrency: num(obj.max_concurrency),
    max_concurrent_requests: num(obj.max_concurrent_requests),
    request_rate: num(obj.request_rate),
    random_input_len: numOrNull(obj.random_input_len),
    random_output_len: numOrNull(obj.random_output_len),
    random_range_ratio: numOrNull(obj.random_range_ratio),
    sharegpt_output_len: numOrNull(obj.sharegpt_output_len),
    accept_length: numOrNull(obj.accept_length),
    tag: strOrNull(obj.tag),
    // detail extras
    samples,
    server_info,
  };
}

function parseAccuracyDetail(
  common: CaseMeta,
  obj: Record<string, unknown>,
): AccuracyDetail {
  // Some runs alias score under the dataset name (e.g. `gsm8k` and `gsm8k:std`).
  // Drop those from `extra` after we've captured the canonical score fields.
  const known = new Set<string>([
    "type", "case", "profile", "target",
    "dataset", "model_id", "score", "score:std",
  ]);
  const datasetKey = strOrNull(obj.dataset) ?? "";
  if (datasetKey) {
    known.add(datasetKey);
    known.add(`${datasetKey}:std`);
  }
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!known.has(k)) extra[k] = v;
  }
  return {
    ...common,
    type: "accuracy",
    dataset: String(obj.dataset ?? ""),
    model_id: String(obj.model_id ?? ""),
    score: num(obj.score),
    score_std: numOrNull(obj["score:std"]),
    extra,
  };
}

/* ---------- summary parse ----------
 * Convenience wrapper: parse the full body and then drop heavy fields so
 * callers (notably /api/cases) only ever ship scalars to the browser.
 */

export function parseCaseSummary(
  body: string,
  meta: { path: string; updated: string },
): ParseResult<CaseSummary> {
  const d = parseCaseDetail(body, meta);
  if (!d.ok) return d;
  return { ok: true, value: summaryOf(d.value) };
}

export function summaryOf(d: CaseDetail): CaseSummary {
  if (d.type === "perf") {
    // strip samples + server_info via destructure
    const { samples: _s, server_info: _si, ...rest } = d;
    void _s;
    void _si;
    return rest;
  }
  const { extra: _e, ...rest } = d;
  void _e;
  return rest;
}
