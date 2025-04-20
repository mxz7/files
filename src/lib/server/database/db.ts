import { env } from "$env/dynamic/private";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

const client = createClient({
  authToken: env.DB_TOKEN || "meow meow meow", // errors during build
  url: env.DB_URL || "libsql://meow-meow-meow.turso.io", // errors during build
});

const db = drizzle(client);

export default db;
