import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

const mocks = vi.hoisted(() => ({ send: vi.fn(), sign: vi.fn() }));

vi.mock("$app/server", () => ({
  query: (schema: { parse: (input: unknown) => unknown }, handler: (input: unknown) => unknown) =>
    Object.assign((input: unknown) => Promise.resolve(handler(schema.parse(input))), {
      __: { type: "query" },
    }),
}));
vi.mock("$app/env/private", () => ({ S3_BUCKET: "test" }));
vi.mock("#lib/server/s3.js", () => ({ s3: { send: mocks.send } }));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mocks.sign }));
vi.mock("#lib/server/database/db.js", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");

  return { default: drizzle(createClient({ url: ":memory:" })) };
});

import db from "#lib/server/database/db.js";
import { uploads, users } from "#lib/server/database/schema.js";
import { getDownloadFile } from "#lib/api/downloads.remote.js";
import { attachmentDisposition, downloadFileName, downloadPagePath } from "#lib/download.js";

const fileId = "photo-id/my%20photo.webp";

beforeAll(async () => {
  await db.run(
    sql`CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, password TEXT, created_at INTEGER, created_ip TEXT, admin INTEGER, invite TEXT)`,
  );
  await db.run(
    sql`CREATE TABLE uploads (id TEXT PRIMARY KEY, label TEXT, created_at INTEGER, created_ip TEXT, created_by_user TEXT, expire_at INTEGER, bytes INTEGER)`,
  );
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));

  await db.delete(uploads);
  await db.delete(users);

  await db.insert(users).values({
    id: "owner",
    username: "max",
    password: "private-hash",
    createdAt: new Date(),
    createdIp: "private-ip",
  });
  await db.insert(uploads).values({
    id: fileId,
    label: "My photo.jpeg",
    bytes: 100,
    createdAt: new Date(),
    createdIp: "private-ip",
    createdByUser: "owner",
    expireAt: new Date(Date.now() + 3600000),
  });

  mocks.send.mockResolvedValue({ ContentLength: 120, ContentType: "image/webp" });
  mocks.sign.mockResolvedValue("https://storage.example/download");
});

afterEach(() => vi.useRealTimers());

describe("public downloads", () => {
  it("returns public metadata and actual storage type/size without authentication", async () => {
    const result = await getDownloadFile(fileId);

    expect(result).toMatchObject({
      name: "My photo.webp",
      label: "My photo.jpeg",
      bytes: 120,
      contentType: "image/webp",
      uploader: "max",
      downloadUrl: "https://storage.example/download",
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(result).not.toHaveProperty("createdByUser");
    expect(mocks.sign.mock.calls[0][1].input).toMatchObject({
      Bucket: "test",
      Key: fileId,
      ResponseContentDisposition: attachmentDisposition("My photo.webp"),
    });
    expect(mocks.sign.mock.calls[0][2]).toEqual({ expiresIn: 900 });
  });

  it("rejects expired, unfinished, and missing files before touching storage", async () => {
    await db.update(uploads).set({ expireAt: new Date(Date.now() - 1000) });

    await expect(getDownloadFile(fileId)).rejects.toMatchObject({ status: 410 });

    await db.update(uploads).set({ bytes: null });

    await expect(getDownloadFile(fileId)).rejects.toMatchObject({ status: 404 });
    await expect(getDownloadFile("missing.txt")).rejects.toMatchObject({ status: 404 });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("limits signed URL lifetime to the remaining file lifetime", async () => {
    await db.update(uploads).set({ expireAt: new Date(Date.now() + 90000) });

    await getDownloadFile(fileId);

    expect(mocks.sign.mock.calls[0][2]).toEqual({ expiresIn: 90 });
  });

  it("handles an uploader who has since been deleted", async () => {
    await db.delete(users);

    expect((await getDownloadFile(fileId)).uploader).toBe("Unknown uploader");
  });

  it("treats objects removed from storage as unavailable", async () => {
    mocks.send.mockRejectedValue({ $metadata: { httpStatusCode: 404 } });

    await expect(getDownloadFile(fileId)).rejects.toMatchObject({ status: 404 });
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("encodes nested object keys without changing their literal percent escapes", () => {
    expect(downloadPagePath(fileId)).toBe("/download/photo-id/my%2520photo.webp");
    expect(downloadPagePath("id/文档.pdf")).toBe("/download/id/%E6%96%87%E6%A1%A3.pdf");
  });

  it("preserves the actual extension and safely constructs attachment headers", () => {
    expect(downloadFileName("photo.jpeg", "id/photo.webp")).toBe("photo.webp");
    expect(downloadFileName("Document", "id/doc.pdf")).toBe("Document.pdf");
    expect(downloadFileName(null, "id/file.zip")).toBe("file.zip");
    expect(() =>
      attachmentDisposition(downloadFileName("photo\ud83d", "id/file.webp")),
    ).not.toThrow();

    const name = downloadFileName('file\r\n"\\文档.pdf', "id/file.pdf");
    const disposition = attachmentDisposition(name);

    expect(disposition).not.toMatch(/[\r\n]/);
    expect(disposition).toContain("filename*=UTF-8''");
    expect(disposition).toContain("%E6%96%87%E6%A1%A3.pdf");
  });
});
