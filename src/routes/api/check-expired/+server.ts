import { env } from "$env/dynamic/private";
import db from "$lib/server/database/db.js";
import { sessions, uploads } from "$lib/server/database/schema.js";
import s3 from "$lib/server/s3.js";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { error, json } from "@sveltejs/kit";
import dayjs from "dayjs";
import { eq, lte } from "drizzle-orm";

export async function GET({ request }) {
  if (request.headers.get("Authorization") !== `Bearer ${env.CRON_SECRET}`) return error(401);

  const expired = await db
    .select({ id: uploads.id })
    .from(uploads)
    .where(lte(uploads.expireAt, new Date()));

  console.log(expired);

  for (const expiredItem of expired) {
    await s3.send(new DeleteObjectCommand({ Bucket: "maxz-dev", Key: expiredItem.id }));
    await db.delete(uploads).where(eq(uploads.id, expiredItem.id));
  }

  console.log(`deleted ${expired.length} expired uploads`);

  await db.delete(sessions).where(lte(sessions.expiresAt, dayjs().unix()));

  return json({ success: true });
}
