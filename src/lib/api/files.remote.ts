import { form, getRequestEvent } from "$app/server";
import { S3_BUCKET } from "$app/env/private";
import db from "#lib/server/database/db.js";
import { uploads } from "#lib/server/database/schema.js";
import { s3 } from "#lib/server/s3.js";
import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { error } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
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

  return { success: true };
});
