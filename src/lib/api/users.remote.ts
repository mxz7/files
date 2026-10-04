import { query, getRequestEvent } from "$app/server";
import { z } from "zod";
import db from "#lib/server/database/db.js";
import { uploads, users } from "#lib/server/database/schema.js";
import { redirect } from "@sveltejs/kit";
import { count, eq, sum } from "drizzle-orm";

const PER_PAGE = 15;

export const getUsers = query(z.number().int().min(1).max(1000000), async (page) => {
  const auth = await getRequestEvent().locals.validate();

  if (!auth.authenticated || !auth.user.admin) return redirect(303, "/files");

  const [{ amount }] = await db.select({ amount: count() }).from(users);
  const lastPage = Math.max(1, Math.ceil(amount / PER_PAGE));

  page = Math.min(page, lastPage);

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
      type: users.admin,
      ip: users.createdIp,
      uploaded: count(uploads.id),
      size: sum(uploads.bytes),
    })
    .from(users)
    .leftJoin(uploads, eq(uploads.createdByUser, users.id))
    .groupBy(users.id)
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE)
    .orderBy(users.username);

  return { rows, page, lastPage };
});
