import { defineConfig } from "drizzle-kit";

const dbUrl = (process.env.DATABASE_URL || "file:./data/radiant.db").trim();
const authToken = process.env.DATABASE_AUTH_TOKEN?.trim() || undefined;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: dbUrl,
    ...(authToken ? { authToken } : {}),
  },
});
