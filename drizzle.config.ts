import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "turso",
  out: "./drizzle",
  schema: "src/lib/server/database/schema.ts",
  dbCredentials: {
    url: process.env.DB_URL!,
    authToken: process.env.DB_TOKEN!,
  },
});
