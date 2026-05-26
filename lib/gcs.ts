import type { CaseDetail, ParseError } from "./types";
import { isCaseObjectName, parseCaseDetail } from "./parse";

export type GcsObjectMeta = { name: string; updated: string };

export interface GcsClient {
  listObjects(prefix: string): Promise<GcsObjectMeta[]>;
  getObject(name: string): Promise<string>;
  // Like getObject, but returns null instead of throwing when the object
  // does not exist. Other errors (auth, network) still throw.
  tryGetObject(name: string): Promise<string | null>;
  putObject(name: string, body: string, contentType?: string): Promise<void>;
  // For single-object detail fetches we also want object metadata (updated).
  statObject(name: string): Promise<GcsObjectMeta>;
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

function isGcsNotFound(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const obj = e as { code?: unknown; status?: unknown; message?: unknown };
  if (obj.code === 404 || obj.status === 404) return true;
  if (typeof obj.message === "string" && /No such object/i.test(obj.message)) return true;
  return false;
}

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
    async tryGetObject(name: string): Promise<string | null> {
      try {
        const [buf] = await b.file(name).download();
        return buf.toString("utf8");
      } catch (e) {
        if (isGcsNotFound(e)) return null;
        throw e;
      }
    },
    async putObject(name: string, body: string, contentType = "application/json"): Promise<void> {
      await b.file(name).save(body, { contentType, resumable: false });
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
