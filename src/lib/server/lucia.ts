import { dev } from "$app/env";
import { DrizzleSQLiteAdapter } from "@lucia-auth/adapter-drizzle";
import { Lucia } from "lucia";
import db from "./database/db";
import { sessions, users } from "./database/schema";

const adapter = new DrizzleSQLiteAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: !dev,
    },
  },
  getUserAttributes(databaseUserAttributes) {
    return {
      username: databaseUserAttributes.username,
      id: databaseUserAttributes.id,
      admin: databaseUserAttributes.admin,
    };
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}

interface DatabaseUserAttributes {
  id: string;
  createdAt: number;
  admin: boolean;
  username: string;
}
