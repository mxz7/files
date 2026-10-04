import { form, getRequestEvent, requested, query, command } from "$app/server";
import { S3_BUCKET } from "$app/env/private";
import db from "#lib/server/database/db.js";
import { uploads } from "#lib/server/database/schema.js";
import { s3 } from "#lib/server/s3.js";
import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { error } from "@sveltejs/kit";
import { and, asc, count, desc, eq, like, or, sql } from "drizzle-orm";
import { redirect } from "@sveltejs/kit";
import { z } from "zod";

const renameSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(100),
  includeLabelInUrl: z.boolean().default(false),
});

export const renameFile = form(renameSchema, async (data) => {
  const auth = await getRequestEvent().locals.validate();

  if (!auth.authenticated) error(401, "Unauthorized");

  const upload = await db
    .select({ createdBy: uploads.createdByUser })
    .from(uploads)
    .where(eq(uploads.id, data.id))
    .limit(1)
    .then((r) => r[0]);

  if (!upload) error(404, "File not found");

  if (upload.createdBy !== auth.user.id) error(403, "Forbidden");

  let id = data.id;
  if (data.includeLabelInUrl) {
    let original = data.id;

    if (original.includes("/")) {
      original = original.substring(original.lastIndexOf("/") + 1);
    }

    id =
      encodeURIComponent(
        data.label.substring(0, 20).toLowerCase().trim().replaceAll(" ", "-").replaceAll("/", "-"),
      ) + `/${original}`;
  }

  await db
    .update(uploads)
    .set({
      label: data.label,
      id,
    })
    .where(eq(uploads.id, data.id));

  if (id !== data.id) {
    await s3.send(
      new CopyObjectCommand({
        Bucket: S3_BUCKET,
        CopySource: `${S3_BUCKET}/${data.id}`,
        Key: id,
      }),
    );

    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: data.id }));
  }

  await requested(getFiles, 1).refreshAll();

  return { success: true };
});

export const getFiles = query(
  z.object({
    page: z.number().int().min(1).max(1000000),
    search: z.string().max(200).catch(""),
    order: z.string().max(20),
  }),
  async ({ page, search, order }) => {
    if (
      ![
        "fileas",
        "filede",
        "sizeas",
        "sizede",
        "dateas",
        "datede",
        "expireas",
        "expirede",
      ].includes(order)
    )
      order = "datede";

    const auth = await getRequestEvent().locals.validate();

    if (!auth.authenticated) redirect(303, "/login");

    const filter = and(
      eq(uploads.createdByUser, auth.user.id),
      search ? or(like(uploads.label, `%${search}%`), like(uploads.id, `%${search}%`)) : undefined,
      sql`${uploads.bytes} IS NOT NULL`,
    );

    const [{ total }] = await db.select({ total: count() }).from(uploads).where(filter);
    const lastPage = Math.max(1, Math.ceil(total / 25));

    page = Math.min(page, lastPage);

    const columns = {
      file: uploads.label,
      size: uploads.bytes,
      date: uploads.createdAt,
      expire: uploads.expireAt,
    };

    const column = order.slice(0, -2) as keyof typeof columns;
    const direction = order.endsWith("as") ? "asc" : "desc";

    const files = await db
      .select({
        id: uploads.id,
        createdAt: uploads.createdAt,
        bytes: uploads.bytes,
        label: uploads.label,
        expireAt: uploads.expireAt,
      })
      .from(uploads)
      .where(filter)
      .orderBy((direction === "asc" ? asc : desc)(columns[column]), asc(uploads.id))
      .offset((page - 1) * 25)
      .limit(25);

    return {
      files,
      page,
      lastPage,
      orderDisplay: { column: column === "file" ? "label" : column, direction },
    };
  },
);

export const deleteFile = command(z.string().min(1), async (id) => {
  const { locals } = getRequestEvent();
  const auth = await locals.validate();

  if (!auth.authenticated) error(401, "Unauthorized");

  const check = await db
    .select({ createdBy: uploads.createdByUser, id: uploads.id })
    .from(uploads)
    .where(eq(uploads.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!check) return error(404);

  if (check.createdBy !== auth.user.id) return error(404);

  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: check.id }));
  await db.delete(uploads).where(eq(uploads.id, check.id));

  await requested(getFiles, 1).refreshAll();

  return { success: true };
});
