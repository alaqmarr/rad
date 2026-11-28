import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const dbUrl = process.env.DATABASE_URL || "file:./data/radiant.db";
const isLocalFileDb = dbUrl.startsWith("file:");

if (isLocalFileDb) {
  const filePath = dbUrl.replace(/^file:/, "");
  const dir = path.dirname(path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const globalForDb = globalThis as unknown as {
  libsqlClient?: ReturnType<typeof createClient>;
  dbPragmasPromise?: Promise<void>;
};

export const client =
  globalForDb.libsqlClient ??
  createClient({
    url: dbUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });

async function applySqlitePragmas(c: Client): Promise<void> {
  if (!isLocalFileDb) return;
  try {
    await c.executeMultiple(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA temp_store = MEMORY;
      PRAGMA cache_size = -65536;
      PRAGMA mmap_size = 268435456;
      PRAGMA busy_timeout = 15000;
      PRAGMA foreign_keys = ON;
    `);
  } catch {
    // Best-effort per-connection PRAGMA initialization (e.g. during build or read-only snapshot)
  }
}

export function ensureDbReady(): Promise<void> {
  if (!globalForDb.dbPragmasPromise) {
    globalForDb.dbPragmasPromise = applySqlitePragmas(client);
  }
  return globalForDb.dbPragmasPromise;
}

globalForDb.libsqlClient = client;

// Kick off PRAGMA tuning immediately at module initialization
void ensureDbReady();

export const db = drizzle(client, { schema });
export * from "./schema";
