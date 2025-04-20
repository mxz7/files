import db from "$lib/server/database/db.js";
import { uploads } from "$lib/server/database/schema.js";
import s3 from "$lib/server/s3.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { error } from "@sveltejs/kit";
import { eq } from "drizzle-orm";

export async function DELETE({ locals, request }) {
  const auth = await locals.validate(false);

  if (!auth.authenticated) return error(403);

  const { id } = await request.json();

  if (!id) return error(400);

  const check = await db
    .select({ createdBy: uploads.createdByUser, id: uploads.id })
    .from(uploads)
    .where(eq(uploads.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!check) return error(404);

  if (check.createdBy !== auth.user.id) return error(404);

  await s3.send(new DeleteObjectCommand({ Bucket: "maxz-dev", Key: check.id }));
  await db.delete(uploads).where(eq(uploads.id, check.id));

  return new Response(null, { status: 200 });
}
