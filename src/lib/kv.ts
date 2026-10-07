import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * A tiny JSON-document store with two backends, chosen at runtime:
 *
 *  - On Cloudflare Workers: a KV namespace bound as `DATA` (wrangler.jsonc).
 *    This is the only writable storage a Worker has — there is no filesystem.
 *  - Locally (`next dev` / `next build` / anything not on Workers): the same
 *    JSON files under src/content/ that the app has always used, so local
 *    development behaves exactly as before and the git-ignored data files keep
 *    working.
 *
 * Each "document" is one JSON value under a name (e.g. "readers"), keeping its
 * existing wrapper shape ({ readers: [...] }). Stores (readers, subscribers,
 * broadcasts) talk only to readDoc/writeDoc, so the backend swap is invisible
 * to them.
 */

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

/** The bound KV namespace when running on Workers, else null (→ fs fallback). */
function kvBinding(): KVNamespace | null {
  try {
    const { env } = getCloudflareContext();
    const ns = (env as Record<string, unknown>).DATA;
    return ns && typeof (ns as KVNamespace).get === "function"
      ? (ns as KVNamespace)
      : null;
  } catch {
    // getCloudflareContext throws when there is no Workers context (local dev,
    // build, tests) — fall back to the filesystem.
    return null;
  }
}

function filePath(name: string): string {
  return path.join(process.cwd(), "src", "content", `${name}.json`);
}

/**
 * True when running on Cloudflare Workers, where the filesystem is read-only.
 * Author editing (saving articles / the featured spotlight) is therefore
 * local-only — edit with `npm run dev`, commit, redeploy. Write paths use this
 * to fail with a clear message instead of an opaque fs error.
 */
export function isReadOnlyRuntime(): boolean {
  return kvBinding() !== null;
}

/** Read a JSON document by name, returning `fallback` when it's missing. */
export async function readDoc<T>(name: string, fallback: T): Promise<T> {
  const ns = kvBinding();
  if (ns) {
    try {
      const raw = await ns.get(name);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
  try {
    return JSON.parse(await fs.readFile(filePath(name), "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Write a JSON document by name (replacing it). */
export async function writeDoc<T>(name: string, value: T): Promise<void> {
  const ns = kvBinding();
  if (ns) {
    await ns.put(name, JSON.stringify(value));
    return;
  }
  const p = filePath(name);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(value, null, 2), "utf8");
}
