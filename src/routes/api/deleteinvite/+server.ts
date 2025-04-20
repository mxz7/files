import db from "$lib/server/database/db.js";
import { invites, uploads, users } from "$lib/server/database/schema.js";
import s3 from "$lib/server/s3.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { error, json } from "@sveltejs/kit";
import { eq, inArray } from "drizzle-orm";

export async function DELETE({ locals, request }) {
  const auth = await locals.validate(false);

  if (!auth.authenticated || !auth.user.admin) return error(401);

  const { invite } = await request.json();

  if (!invite) return error(400);

  const inviteData = await db
    .select({ id: invites.id, usedBy: invites.usedBy })
    .from(invites)
    .where(eq(invites.id, invite))
    .then((r) => r[0]);

  if (!inviteData) return error(404);

  if (!inviteData.usedBy) {
    await db.delete(invites).where(eq(invites.id, inviteData.id));

    return json({ ok: true });
  }

  const userUploads = await db
    .select({ id: uploads.id })
    .from(uploads)
    .where(eq(uploads.createdByUser, inviteData.usedBy));

  if (userUploads.length > 0) {
    for (const upload of userUploads) {
      await s3.send(new DeleteObjectCommand({ Bucket: "maxz-dev", Key: upload.id }));
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

  return json({ ok: true });
}
