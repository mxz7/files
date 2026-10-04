import { DB_TOKEN, DB_URL } from "$app/env/private";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

const client = createClient({
  authToken: DB_TOKEN || "meow meow meow", // errors during build
  url: DB_URL || "libsql://meow-meow-meow.turso.io", // errors during build
});

const db = drizzle(client);

export default db;
