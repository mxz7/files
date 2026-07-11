import { nanoid } from "$lib/nanoid.js";
import db from "$lib/server/database/db.js";
import { invites, users } from "$lib/server/database/schema.js";
import { fail, redirect } from "@sveltejs/kit";
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

export const actions = {
  create: async ({ request, locals }) => {
    const auth = await locals.validate();

    if (!auth.authenticated || !auth.user.admin) return fail(401);

    const formData = await request.formData();

    const labelEntry = formData.get("label");

    if (typeof labelEntry !== "string") return fail(400);

    const label = labelEntry.trim();

    if (!label) return fail(400);

    const id = nanoid(32);

    await db.insert(invites).values({ id, createdAt: new Date(), label });

    return "success";
  },
};
