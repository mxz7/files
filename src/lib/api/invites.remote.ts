import { S3_BUCKET } from "$app/env/private";
import { s3 } from "#lib/server/s3.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { form, getRequestEvent, requested, query, command } from "$app/server";
import { nanoid } from "#lib/nanoid.js";
import db from "#lib/server/database/db.js";
import { invites, users, uploads } from "#lib/server/database/schema.js";
import { error, redirect } from "@sveltejs/kit";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

export const createInvite = form(
  z.object({ label: z.string().trim().min(1) }),
  async ({ label }) => {
    const auth = await getRequestEvent().locals.validate();

    if (!auth.authenticated || !auth.user.admin) error(401, "Unauthorized");

    await db.insert(invites).values({ id: nanoid(32), createdAt: new Date(), label });

    await requested(getInvites, 1).refreshAll();

    return { success: true };
  },
);

export const getInvites = query(async () => {
  const auth = await getRequestEvent().locals.validate();

  if (!auth.authenticated || !auth.user.admin) redirect(303, "/login");

  const rows = await db
    .select({
      id: invites.id,
      label: invites.label,
      createdAt: invites.createdAt,
      username: users.username,
    })
    .from(invites)
    .leftJoin(users, eq(users.id, invites.usedBy))
    .orderBy(desc(invites.createdAt));

  return { invites: rows };
});

export const deleteInvite = command(z.string().min(1), async (invite) => {
  const { locals } = getRequestEvent();
  const auth = await locals.validate();

  if (!auth.authenticated || !auth.user.admin) error(401, "Unauthorized");

  const inviteData = await db
    .select({ id: invites.id, usedBy: invites.usedBy })
    .from(invites)
    .where(eq(invites.id, invite))
    .then((r) => r[0]);

  if (!inviteData) return error(404);

  if (!inviteData.usedBy) {
    await db.delete(invites).where(eq(invites.id, inviteData.id));

    await requested(getInvites, 1).refreshAll();

    return { success: true };
  }

  const userUploads = await db
    .select({ id: uploads.id })
    .from(uploads)
    .where(eq(uploads.createdByUser, inviteData.usedBy));

  if (userUploads.length > 0) {
    for (const upload of userUploads) {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: upload.id }));
    }

    await db.delete(uploads).where(
      inArray(
        uploads.id,
        userUploads.map((u) => u.id),
      ),
    );
  }

  await db.delete(invites).where(eq(invites.id, inviteData.id));
  await db.delete(users).where(eq(users.id, inviteData.usedBy));

  await requested(getInvites, 1).refreshAll();

  return { success: true };
});
