import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const dbUrl = process.env.DATABASE_URL || "file:./data/radiant.db";

if (dbUrl.startsWith("file:")) {
  const filePath = dbUrl.replace(/^file:/, "");
  const dir = path.dirname(path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const globalForDb = globalThis as unknown as {
  libsqlClient?: ReturnType<typeof createClient>;
};

export const client =
  globalForDb.libsqlClient ??
  createClient({
    url: dbUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.libsqlClient = client;
}

export const db = drizzle(client, { schema });
export * from "./schema";
