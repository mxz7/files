import { command, getRequestEvent } from "$app/server";
import { S3_BUCKET } from "$app/env/private";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { error, isHttpError } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import db from "#lib/server/database/db.js";
import { uploads } from "#lib/server/database/schema.js";
import { s3 } from "#lib/server/s3.js";
import { createUploadGrant, readUploadGrant, type UploadGrant } from "#lib/server/upload-grants.js";
import { imageFormats, MAX_IMAGE_BYTES, processImage } from "#lib/server/images.js";
import { validateSession } from "#lib/server/auth/session.js";
import { stripExif } from "#lib/server/exif.js";

const uploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  size: z.number().int().min(0).max(1_000_000_000),
  contentType: z
    .string()
    .regex(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i)
    .max(100),
  expire: z.number().min(0).max(3.154e12),
  anonymize: z.boolean(),
});

const grantToken = z.string().min(1).max(4096);

const videoTypes = new Set(["video/quicktime", "video/mp4", "video/x-msvideo", "video/x-matroska"]);

const extensions: Record<string, string> = {
  "text/plain": "txt",
  "text/csv": "csv",
  "text/html": "html",
  "text/xml": "xml",
  "text/css": "css",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogg",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/gzip": "gz",
  "application/x-tar": "tar",
  "application/vnd.rar": "rar",
  "application/javascript": "js",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

function temporaryKey(grant: UploadGrant) {
  return `_pending/${grant.id}`;
}

function finalKey(grant: UploadGrant) {
  const extension = imageFormats[grant.contentType]
    ? "webp"
    : (extensions[grant.contentType] ??
      grant.fileName
        .split(".")
        .at(-1)
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 10) ??
      "bin");

  const originalName = grant.fileName.split(".").slice(0, -1).join(".");
  const shortName = Array.from(originalName).slice(0, 20).join("");

  const name = grant.anonymize
    ? ""
    : encodeURIComponent(shortName.trim().replaceAll(" ", "-").replaceAll("/", "-"));

  return `${grant.id}${name ? `/${name}` : ""}.${extension || "bin"}`;
}

async function requireUploader() {
  const { locals, request } = getRequestEvent();
  const auth = await locals.validate();

  if (auth.authenticated) return auth.user;

  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];

  if (token) {
    const bearer = await validateSession(token, { refresh: false });

    if (bearer) {
      locals.authedUser = bearer.user;
      return bearer.user;
    }
  }

  error(401, "Unauthorized");
}

async function cleanUp(grant: UploadGrant) {
  await s3
    .send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: temporaryKey(grant) }))
    .catch((err) => {
      getRequestEvent().locals.logger.warn(
        { err, upload_id: grant.id },
        "Failed to clean up temporary upload",
      );
    });
}

export const createUpload = command(uploadSchema, async (data) => {
  const user = await requireUploader();

  if (data.expire > 31556952000 && !user.admin) error(403, "Only admins can choose this expiry");

  if (imageFormats[data.contentType] && data.size > MAX_IMAGE_BYTES)
    error(400, "Images must be smaller than 50 MB");

  const grant: UploadGrant = {
    ...data,
    id: randomUUID(),
    userId: user.id,
    label: data.fileName.slice(0, 50),
    expiresAt: Date.now() + 15 * 60 * 1000,
  };

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: temporaryKey(grant),
      ContentType: data.contentType,
      ContentLength: data.size,
    }),
    { expiresIn: 15 * 60, signableHeaders: new Set(["content-type"]) },
  );

  return { grant: createUploadGrant(grant), uploadUrl };
});

export const finalizeUpload = command(grantToken, async (token) => {
  const user = await requireUploader();
  const grant = readUploadGrant(token, user.id);

  if (grant.expire > 31556952000 && !user.admin) error(403, "Only admins can choose this expiry");

  const key = finalKey(grant);

  const [existing] = await db
    .select({ id: uploads.id, createdBy: uploads.createdByUser })
    .from(uploads)
    .where(eq(uploads.id, key))
    .limit(1);

  if (existing) {
    if (existing.createdBy !== user.id) error(403, "Forbidden");

    await cleanUp(grant);

    return { id: key };
  }

  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: temporaryKey(grant) }),
    );

    if (head.ContentLength !== grant.size || head.ContentType !== grant.contentType || !head.ETag)
      error(400, "The uploaded file did not match the authorized upload");

    let size = grant.size;

    if (imageFormats[grant.contentType] || videoTypes.has(grant.contentType)) {
      const object = await s3.send(
        new GetObjectCommand({ Bucket: S3_BUCKET, Key: temporaryKey(grant), IfMatch: head.ETag }),
      );

      if (!object.Body || object.ContentLength !== grant.size)
        error(400, "The uploaded file could not be read");

      const source = Buffer.from(await object.Body.transformToByteArray());

      if (source.byteLength !== grant.size)
        error(400, "The uploaded file did not match the authorized upload");

      let processed: Buffer;

      if (imageFormats[grant.contentType]) {
        try {
          processed = await processImage(source, grant.contentType);
        } catch {
          error(400, "The image is invalid, too large, animated, or unsupported");
        }
      } else {
        const result = await stripExif(
          new File([source], grant.fileName, { type: grant.contentType }),
          grant.id,
          getRequestEvent().locals.logger,
        );

        if (!result.success) error(400, "Failed to strip media metadata");

        processed = result.file;
      }

      size = processed.byteLength;

      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: processed,
          ContentType: imageFormats[grant.contentType] ? "image/webp" : grant.contentType,
          ContentLength: size,
        }),
      );
    } else {
      await s3.send(
        new CopyObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          CopySource: `${S3_BUCKET}/${temporaryKey(grant)}`,
          CopySourceIfMatch: head.ETag,
          MetadataDirective: "REPLACE",
          ContentType: ["text/html", "text/xml"].includes(grant.contentType)
            ? "text/plain"
            : grant.contentType,
        }),
      );
    }

    const { getClientAddress } = getRequestEvent();

    await db
      .insert(uploads)
      .values({
        id: key,
        label: grant.label,
        createdByUser: user.id,
        createdIp: getClientAddress(),
        createdAt: new Date(),
        expireAt: new Date(Date.now() + grant.expire),
        bytes: size,
      })
      .onConflictDoNothing();

    await cleanUp(grant);

    return { id: key };
  } catch (cause) {
    await cleanUp(grant);

    // SvelteKit errors preserve their status; object-store errors stay in server logs.
    if (isHttpError(cause)) throw cause;

    getRequestEvent().locals.logger.error(
      { err: cause, upload_id: grant.id },
      "Failed to finalize upload",
    );

    error(400, "The upload could not be completed. Please try again.");
  }
});

export const cancelUpload = command(grantToken, async (token) => {
  const user = await requireUploader();

  await cleanUp(readUploadGrant(token, user.id, false));

  return { success: true };
});
