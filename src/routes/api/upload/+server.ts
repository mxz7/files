import { env } from "$env/dynamic/private";
import { nanoid } from "$lib/nanoid.js";
import db from "$lib/server/database/db.js";
import { uploads } from "$lib/server/database/schema.js";
import { stripExif } from "$lib/server/exif.js";
import { lucia } from "$lib/server/lucia.js";
import s3 from "$lib/server/s3.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { error, json } from "@sveltejs/kit";
import dayjs from "dayjs";
import { z } from "zod";

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

const mimeToExtensionMap = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/gif", "gif"],
  ["image/bmp", "bmp"],
  ["image/tiff", "tiff"],
  ["image/webp", "webp"],
  ["text/plain", "txt"],
  ["text/csv", "csv"],
  ["text/html", "html"],
  ["text/xml", "xml"],
  ["text/css", "css"],
  ["audio/mpeg", "mp3"],
  ["audio/wav", "wav"],
  ["audio/ogg", "ogg"],
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/ogg", "ogg"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
  ["application/x-tar", "tar"],
  ["application/gzip", "gz"],
  ["application/zip", "zip"],
  ["application/vnd.rar", "rar"],
  ["application/pdf", "pdf"],
  ["application/javascript", "js"],
]);

const schema = z.object({
  label: z.string().min(1).max(50),
  expire: z.coerce.number().min(0).max(3.154e12),
  anonymize: z.coerce.boolean(),
  file: z.instanceof(File),
});

export async function POST({ locals, getClientAddress, request }) {
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

  if (!auth.authenticated) return error(401, { message: "Unauthorized" });

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return error(400, { message: "Invalid form data" });
  }

  const data = schema.safeParse(Object.fromEntries(formData.entries()));

  if (!data.success) {
    return error(400, { message: JSON.stringify(data.error.format()) });
  }

  const { file, expire, label, anonymize } = data.data;

  if (file.size > 1000000000) return error(400, { message: "File too large" });
  if (expire > 31556952000 && !auth.user.admin) return error(400);

  let id = nanoid();

  if (file.name && !anonymize) {
    id = `${id}/${encodeURIComponent(
      file.name
        .substring(0, 20)
        .toLowerCase()
        .trim()
        .replaceAll(" ", "-")
        .replaceAll("/", "-")
        .split(".")
        .slice(0, -1)
        .join("."),
    )}`;
  }

  let buffer: Buffer;

  if (exifTypes.includes(file.type)) {
    const exif = await stripExif(file, id);

    if (!exif.success) return error(500, { message: "Failed to strip exif data" });

    buffer = exif.file;
  } else {
    buffer = Buffer.from(await file.arrayBuffer());
  }

  let key = id;
  let contentType = file.type;

  if (mimeToExtensionMap.has(file.type)) {
    key += `.${mimeToExtensionMap.get(file.type)}`;
  } else {
    key += `.${file.type.split("/")[1]}`;
  }

  switch (contentType) {
    case "text/html":
      contentType = "text/plain";
      break;
    case "text/xml":
      contentType = "text/plain";
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

  await db.insert(uploads).values({
    label,
    createdIp: getClientAddress(),
    id: key,
    createdByUser: auth.user.id,
    expireAt: dayjs().add(data.data.expire, "milliseconds").toDate(),
    createdAt: new Date(),
    bytes: buffer.byteLength,
  });

  return json({ id: key });
}
