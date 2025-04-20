import { env } from "$env/dynamic/private";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

const client = createClient({ authToken: env.DB_TOKEN, url: env.DB_URL });

const db = drizzle(client);

export default db;
