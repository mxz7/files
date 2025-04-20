import { env } from "$env/dynamic/private";
import db from "$lib/server/database/db.js";
import { uploads } from "$lib/server/database/schema.js";
import { stripExif } from "$lib/server/exif.js";
import { lucia } from "$lib/server/lucia";
import s3 from "$lib/server/s3.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { error, json } from "@sveltejs/kit";
import { eq } from "drizzle-orm";

const exifTypes = [
  "image/jpeg",
  "image/tiff",
  "image/heic",
  "image/heif",
  "image/webp",
  "image/png",
  "video/quicktime",
  "video/mp4",
  "video/x-msvideo",
  "video/x-matroska",
];

export async function PUT({ request, params, locals }) {
  let auth = await locals.validate(false);

  if (!auth.authenticated && request.headers.get("authorization")) {
    const bearer = lucia.readBearerToken(request.headers.get("authorization")!);

    if (bearer) {
      const bearerAuth = await lucia.validateSession(bearer);

      if (bearerAuth.user) {
        auth = {
          authenticated: true,
          ...bearerAuth,
        };
      }
    }
  }

  if (!auth.authenticated) return error(401);

  const { id } = params;

  if (!id) return error(400);

  const check = await db
    .select({ createdBy: uploads.createdByUser, id: uploads.id, bytes: uploads.bytes })
    .from(uploads)
    .where(eq(uploads.id, id))
    .limit(1)
    .then((r) => r[0]);

  if (!check) return error(404, { message: "Upload not found" });

  if (check.createdBy !== auth.user.id) return error(401);
  if (check.bytes) return error(409);

  const data = await request.formData();

  const file = data.get("file") as File | null;

  if (!file) return error(400, { message: "No file" });

  if (file.size > 1000000000) return error(400, { message: "File too large" });

  let buffer: Buffer;

  if (exifTypes.includes(file.type)) {
    const exif = await stripExif(file, id);

    if (!exif.success) return error(500, { message: "Failed to strip exif data" });

    buffer = exif.file;
  } else {
    buffer = Buffer.from(await file.arrayBuffer());
  }

  let key = id;

  switch (file.type) {
    case "video/quicktime":
      key += ".mov";
      break;
    case "video/x-msvideo":
      key += ".avi";
      break;
    case "video/x-matroska":
      key += ".mkv";
      break;
    default:
      key += `.${file.type.split("/")[1]}`;
      break;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }),
  );

  await db.update(uploads).set({ bytes: buffer.byteLength, id: key }).where(eq(uploads.id, id));

  return json({ id: key });
}
