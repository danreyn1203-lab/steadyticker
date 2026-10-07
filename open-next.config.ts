import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext adapter config for Cloudflare Workers. Defaults are fine for this
// app: routes are mostly dynamic (server-rendered per request), and the data
// that must persist (readers, subscribers) lives in the DATA KV namespace via
// src/lib/kv.ts rather than in any cache.
export default defineCloudflareConfig();
