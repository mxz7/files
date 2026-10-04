import db from "#lib/server/database/db.js";
import { sessions as sessionTable } from "#lib/server/database/schema.js";
import { redirect } from "@sveltejs/kit";
import { asc, eq } from "drizzle-orm";

export async function load({ parent }) {
  const { auth } = await parent();

  if (!auth.authenticated) return redirect(302, "/files");

  const sessions = await db
    .select({
      id: sessionTable.id,
      expiresAt: sessionTable.expiresAt,
    })
    .from(sessionTable)
    .where(eq(sessionTable.userId, auth.user.id))
    .orderBy(asc(sessionTable.expiresAt));

  return {
    sessions: sessions.map((s) => ({ expiresAt: s.expiresAt, current: s.id === auth.session.id })),
  };
}
