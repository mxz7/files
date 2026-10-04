import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import sharp from "sharp";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const mocks = vi.hoisted(() => ({
  validate: vi.fn(),
  send: vi.fn(),
  sign: vi.fn(),
  stripExif: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn() },
  validateSession: vi.fn(),
  authorization: undefined as string | undefined,
}));
vi.mock("$app/server", () => ({
  command: (_schema: unknown, handler: object) =>
    Object.assign(handler, { __: { type: "command" } }),
  getRequestEvent: () => ({
    locals: { validate: mocks.validate, logger: mocks.logger },
    request: {
      headers: new Headers(mocks.authorization ? { authorization: mocks.authorization } : {}),
    },
    getClientAddress: () => "127.0.0.1",
  }),
}));
vi.mock("$app/env/private", () => ({ S3_BUCKET: "test", CRON_SECRET: "test-secret" }));
vi.mock("#lib/server/s3.js", () => ({ s3: { send: mocks.send } }));
vi.mock("#lib/server/auth/session.js", () => ({ validateSession: mocks.validateSession }));
vi.mock("#lib/server/exif.js", () => ({ stripExif: mocks.stripExif }));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mocks.sign }));
vi.mock("#lib/server/database/db.js", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  return { default: drizzle(createClient({ url: ":memory:" })) };
});

import db from "#lib/server/database/db.js";
import { uploads } from "#lib/server/database/schema.js";
import { createUpload, finalizeUpload, cancelUpload } from "#lib/api/uploads.remote.js";
import { createUploadGrant, readUploadGrant } from "#lib/server/upload-grants.js";
import { processImage } from "#lib/server/images.js";

type ObjectData = { bytes: Buffer; contentType: string; etag: string };
const objects = new Map<string, ObjectData>();
const input = {
  fileName: "photo.jpg",
  size: 10,
  contentType: "image/jpeg",
  expire: 86400000,
  anonymize: false,
};
function run<T>(remote: unknown, input: unknown): Promise<T> {
  return (remote as (input: unknown) => Promise<T>)(input);
}

async function prepare(bytes: Buffer, contentType = "text/plain", fileName = "file.txt") {
  const result = await run<{ grant: string; uploadUrl: string }>(createUpload, {
    ...input,
    contentType,
    fileName,
    size: bytes.byteLength,
  });

  const grant = readUploadGrant(result.grant, "one");
  objects.set(`_pending/${grant.id}`, { bytes, contentType, etag: '"test-etag"' });

  return result;
}

beforeAll(async () => {
  await db.run(
    sql`CREATE TABLE uploads (id TEXT PRIMARY KEY, label TEXT, created_at INTEGER, created_ip TEXT, created_by_user TEXT, expire_at INTEGER, bytes INTEGER)`,
  );
});

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(uploads);

  objects.clear();
  mocks.authorization = undefined;

  mocks.validate.mockResolvedValue({ authenticated: true, user: { id: "one", admin: false } });
  mocks.sign.mockResolvedValue("https://storage.example/upload");

  mocks.send.mockImplementation(async (command) => {
    const key = command.input.Key;

    if (command instanceof DeleteObjectCommand) {
      objects.delete(key);
      return {};
    }

    if (command instanceof PutObjectCommand) {
      if (!Buffer.isBuffer(command.input.Body) || !command.input.ContentType) {
        throw new Error("Expected a buffer and content type");
      }

      objects.set(key, {
        bytes: Buffer.from(command.input.Body),
        contentType: command.input.ContentType,
        etag: '"final-etag"',
      });
      return {};
    }

    if (command instanceof CopyObjectCommand) {
      if (!command.input.CopySource || !command.input.ContentType) {
        throw new Error("Expected a source and content type");
      }

      const object = objects.get(command.input.CopySource.slice("test/".length));
      if (!object || object.etag !== command.input.CopySourceIfMatch)
        throw new Error("Precondition failed");
      objects.set(key, { ...object, contentType: command.input.ContentType });
      return {};
    }

    const object = objects.get(key);
    if (!object) throw new Error("NoSuchKey");

    if (command instanceof HeadObjectCommand)
      return {
        ContentLength: object.bytes.byteLength,
        ContentType: object.contentType,
        ETag: object.etag,
      };
    if (command instanceof GetObjectCommand) {
      if (object.etag !== command.input.IfMatch) throw new Error("Precondition failed");
      return {
        ContentLength: object.bytes.byteLength,
        Body: { transformToByteArray: async () => object.bytes },
      };
    }

    throw new Error("Unexpected command");
  });
});

describe("presigned upload flow", () => {
  it.each([createUpload, finalizeUpload, cancelUpload])(
    "requires authentication before storage access",
    async (remote) => {
      mocks.validate.mockResolvedValue({ authenticated: false });
      await expect(run(remote, input)).rejects.toMatchObject({ status: 401 });

      expect(mocks.send).not.toHaveBeenCalled();
      expect(mocks.sign).not.toHaveBeenCalled();
    },
  );

  it("accepts bearer keys without extending their expiry", async () => {
    mocks.validate.mockResolvedValue({ authenticated: false });
    mocks.authorization = "Bearer raw-api-token";
    mocks.validateSession.mockResolvedValue({ user: { id: "one", admin: false } });

    await run(createUpload, input);

    expect(mocks.validateSession).toHaveBeenCalledWith("raw-api-token", { refresh: false });
    expect(mocks.sign).toHaveBeenCalledOnce();
  });

  it("signs temporary uploads for the declared type and size", async () => {
    await run(createUpload, input);

    expect(mocks.sign.mock.calls[0][1].input).toMatchObject({
      Bucket: "test",
      ContentType: "image/jpeg",
      ContentLength: 10,
    });

    expect(mocks.sign.mock.calls[0][1].input.Key).toMatch(/^_pending\//);
    expect(mocks.sign.mock.calls[0][2]).toMatchObject({
      expiresIn: 900,
      signableHeaders: new Set(["content-type"]),
    });

    expect(await db.select().from(uploads)).toEqual([]);
  });

  it("enforces admin expiry and image limits before issuing a URL", async () => {
    await expect(run(createUpload, { ...input, expire: 1577847600000 })).rejects.toMatchObject({
      status: 403,
    });
    await expect(run(createUpload, { ...input, size: 50000001 })).rejects.toMatchObject({
      status: 400,
    });

    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("rejects other users and tampered grants without reading storage", async () => {
    const { grant } = await prepare(Buffer.from("hello"));
    mocks.validate.mockResolvedValue({ authenticated: true, user: { id: "two" } });
    await expect(run(finalizeUpload, grant)).rejects.toMatchObject({ status: 400 });
    await expect(run(cancelUpload, grant)).rejects.toMatchObject({ status: 400 });
    mocks.validate.mockResolvedValue({ authenticated: true, user: { id: "one" } });
    await expect(run(finalizeUpload, grant + "tampered")).rejects.toMatchObject({ status: 400 });

    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects expired grants but permits their owner to clean up", async () => {
    const created = await prepare(Buffer.from("hello"));
    const grant = readUploadGrant(created.grant, "one");
    const expired = createUploadGrant({ ...grant, expiresAt: Date.now() - 1 });
    await expect(run(finalizeUpload, expired)).rejects.toMatchObject({ status: 400 });
    await run(cancelUpload, expired);

    expect(objects.size).toBe(0);
  });

  it.each(["size", "type"])(
    "rejects mismatched %s and cleans up staging without publishing",
    async (mismatch) => {
      const created = await prepare(Buffer.from("hello"));
      const grant = readUploadGrant(created.grant, "one");
      const object = objects.get(`_pending/${grant.id}`)!;
      if (mismatch === "size") object.bytes = Buffer.from("too long");
      else object.contentType = "text/html";
      await expect(run(finalizeUpload, created.grant)).rejects.toMatchObject({ status: 400 });

      expect(objects.size).toBe(0);
      expect(await db.select().from(uploads)).toEqual([]);
    },
  );

  it("copies nonimages and makes finalization retryable without republishing", async () => {
    const { grant } = await prepare(Buffer.from("<h1>test</h1>"), "text/html", "file.html");
    const result = await run<{ id: string }>(finalizeUpload, grant);

    expect(objects.get(result.id)?.contentType).toBe("text/plain");
    expect(objects.size).toBe(1);
    expect((await db.select().from(uploads))[0]).toMatchObject({
      id: result.id,
      createdByUser: "one",
      bytes: 13,
    });
    mocks.send.mockClear();

    expect(await run(finalizeUpload, grant)).toEqual(result);
    expect(mocks.send.mock.calls.every(([command]) => command instanceof DeleteObjectCommand)).toBe(
      true,
    );

    expect(await db.select().from(uploads)).toHaveLength(1);
  });

  it("strips image metadata and applies EXIF orientation before publication", async () => {
    const source = await sharp({ create: { width: 4, height: 2, channels: 3, background: "red" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExifMerge({ IFD0: { Artist: "private-person" } })
      .toBuffer();

    expect((await sharp(source).metadata()).exif).toBeDefined();
    const { grant } = await prepare(source, "image/jpeg", "photo.jpg");
    const { id } = await run<{ id: string }>(finalizeUpload, grant);
    const object = objects.get(id)!;
    const metadata = await sharp(object.bytes).metadata();

    expect(id).toMatch(/\.webp$/);
    expect(object.contentType).toBe("image/webp");
    expect(metadata).toMatchObject({ width: 2, height: 4 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect((await db.select().from(uploads))[0].bytes).toBe(object.bytes.byteLength);
    expect(objects.size).toBe(1);
  });

  it("rejects invalid and mislabelled images without publishing", async () => {
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } })
      .png()
      .toBuffer();
    await expect(processImage(png, "image/jpeg")).rejects.toThrow("content type");
    const { grant } = await prepare(Buffer.from("invalid image"), "image/jpeg");
    await expect(run(finalizeUpload, grant)).rejects.toMatchObject({ status: 400 });

    expect(objects.size).toBe(0);
    expect(await db.select().from(uploads)).toEqual([]);
  });

  it("cancels staging without deleting a published file", async () => {
    const { grant } = await prepare(Buffer.from("hello"));
    const result = await run<{ id: string }>(finalizeUpload, grant);
    await run(cancelUpload, grant);

    expect(objects.has(result.id)).toBe(true);
    expect(await db.select().from(uploads)).toHaveLength(1);
  });
});
