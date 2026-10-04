import db from "#lib/server/database/db.js";
import { uploads, users } from "#lib/server/database/schema.js";
import { redirect } from "@sveltejs/kit";
import { count, eq, sum } from "drizzle-orm";

const PER_PAGE = 15;

export async function load({ url, parent }) {
  const { auth } = await parent();

  if (!auth.authenticated || !auth.user.admin) return redirect(302, "/files");

  let page = parseInt(url.searchParams.get("page") || "1") || 1;

  if (page < 1) page = 1;

  const [rows, amount] = await Promise.all([
    db
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
      .offset((page - 1) * PER_PAGE),
    db.select({ amount: count() }).from(users),
  ]);

  const lastPage = Math.floor(amount[0].amount / PER_PAGE) + 1;

  return { rows, page, lastPage };
}
