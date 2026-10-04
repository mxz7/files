import db from "#lib/server/database/db.js";
import { invites, users } from "#lib/server/database/schema.js";
import { redirect } from "@sveltejs/kit";
import { desc, eq } from "drizzle-orm";

export async function load({ locals, depends }) {
  depends("invites");
  const auth = await locals.validate();

  if (!auth.authenticated || !auth.user.admin) return redirect(302, "/login");

  const invitesData = await db
    .select({
      id: invites.id,
      label: invites.label,
      createdAt: invites.createdAt,
      username: users.username,
    })
    .from(invites)
    .leftJoin(users, eq(users.id, invites.usedBy))
    .orderBy(desc(invites.createdAt));

  return { invites: invitesData };
}
