import { query } from "$app/server";
import { S3_BUCKET } from "$app/env/private";
import { error } from "@sveltejs/kit";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { eq } from "drizzle-orm";
import { z } from "zod";
import db from "#lib/server/database/db.js";
import { uploads, users } from "#lib/server/database/schema.js";
import { s3 } from "#lib/server/s3.js";
import { attachmentDisposition, downloadFileName } from "#lib/download.js";

export const getDownloadFile = query(z.string().min(1).max(1024), async (id) => {
  const [file] = await db
    .select({
      label: uploads.label,
      bytes: uploads.bytes,
      uploadedAt: uploads.createdAt,
      expiresAt: uploads.expireAt,
      uploader: users.username,
    })
    .from(uploads)
    .leftJoin(users, eq(users.id, uploads.createdByUser))
    .where(eq(uploads.id, id))
    .limit(1);

  if (!file || file.bytes === null) error(404, "This file is no longer available.");

  const remainingSeconds = Math.floor((file.expiresAt.getTime() - Date.now()) / 1000);

  if (remainingSeconds < 1) error(410, "This file has expired.");

  let object;

  try {
    object = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: id }));
  } catch (cause) {
    if (cause && typeof cause === "object" && "$metadata" in cause) {
      const status = (cause.$metadata as { httpStatusCode?: number }).httpStatusCode;

      if (status === 404) error(404, "This file is no longer available.");
    }

    throw cause;
  }

  const name = downloadFileName(file.label, id);
  const downloadUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: id,
      ResponseContentDisposition: attachmentDisposition(name),
    }),
    { expiresIn: Math.min(900, remainingSeconds) },
  );

  return {
    name,
    label: file.label || name,
    bytes: object.ContentLength ?? file.bytes,
    contentType: object.ContentType || "application/octet-stream",
    uploader: file.uploader || "Unknown uploader",
    uploadedAt: file.uploadedAt,
    expiresAt: file.expiresAt,
    downloadUrl,
  };
});
