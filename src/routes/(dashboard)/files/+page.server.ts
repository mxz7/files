import db from "$lib/server/database/db.js";
import { uploads } from "$lib/server/database/schema.js";
import { redirect } from "@sveltejs/kit";
import { SQL, and, asc, count, desc, eq, like, or, sql, type SQLWrapper } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { fail, message, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { z } from "zod";

const renameSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(100).trim(),
});

export async function load({ locals, url, depends }) {
  depends("file_uploads");

  const auth = await locals.validate();

  if (!auth.authenticated) return redirect(302, "/login");

  let page = parseInt(url.searchParams.get("page") || "1") || 1;

  if (page < 1) page = 1;

  let orderBy = desc(uploads.createdAt);
  const orderDisplay: {
    column: "createdAt" | "label" | "date" | "expire" | "size";
    direction: "desc" | "asc";
  } = { column: "createdAt", direction: "desc" };

  const search = url.searchParams.get("search")?.toLowerCase() || "";

  if (url.searchParams.has("order")) {
    const order = url.searchParams.get("order")!;
    let orderColumn: SQLiteColumn;
    let orderDirection: (column: SQLWrapper) => SQL;

    switch (order.substring(0, order.length - 2)) {
      case "file":
        orderColumn = uploads.label;
        orderDisplay.column = "label";
        break;
      case "size":
        orderColumn = uploads.bytes;
        orderDisplay.column = "size";
        break;
      case "date":
        orderColumn = uploads.createdAt;
        orderDisplay.column = "date";
        break;
      case "expire":
        orderColumn = uploads.expireAt;
        orderDisplay.column = "expire";
        break;
    }

    if (order.substring(order.length - 2) === "as") {
      orderDirection = asc;
      orderDisplay.direction = "asc";
    } else {
      orderDirection = desc;
      orderDisplay.direction = "desc";
    }

    orderBy = orderDirection(orderColumn!);
  }

  const [files, fileCount] = await Promise.all([
    db
      .select({
        id: uploads.id,
        createdAt: uploads.createdAt,
        bytes: uploads.bytes,
        label: uploads.label,
        expireAt: uploads.expireAt,
        deleted: sql<boolean>`false`,
      })
      .from(uploads)
      .orderBy(orderBy)
      .offset((page - 1) * 25)
      .limit(25)
      .where(
        and(
          eq(uploads.createdByUser, auth.user.id),
          search
            ? or(like(uploads.label, `%${search}%`), like(uploads.id, `%${search}%`))
            : undefined,
        ),
      ),
    db
      .select({ count: count() })
      .from(uploads)
      .where(
        and(
          eq(uploads.createdByUser, auth.user.id),
          search
            ? or(like(uploads.label, `%${search}%`), like(uploads.id, `%${search}%`))
            : undefined,
        ),
      )
      .limit(1)
      .then((r) => r[0]),
  ]);

  if (files.length === 0 && page > 1) {
    url.searchParams.set("page", (page - 1).toString());
    return redirect(302, `/files?${url.searchParams.toString()}`);
  }

  return {
    files,
    user: auth.user,
    form: await superValidate(zod(renameSchema)),
    page,
    lastPage: Math.ceil(fileCount.count / 25),
    orderDisplay,
  };
}

export const actions = {
  rename: async ({ locals, request }) => {
    const auth = await locals.validate();

    if (!auth.authenticated) return fail(400);

    const form = await superValidate(request, zod(renameSchema));

    if (!form.valid) return fail(400, { form });

    const upload = await db
      .select({ createdBy: uploads.createdByUser })
      .from(uploads)
      .where(eq(uploads.id, form.data.id))
      .limit(1)
      .then((r) => r[0]);

    if (!upload) return fail(404, { form });

    if (upload.createdBy !== auth.user.id) return fail(403, { form });

    await db.update(uploads).set({ label: form.data.label }).where(eq(uploads.id, form.data.id));

    return message(form, "success");
  },
};
