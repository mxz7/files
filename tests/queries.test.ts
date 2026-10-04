import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

const mocks = vi.hoisted(() => ({ validate: vi.fn() }));
vi.mock("$app/server", () => ({
  query: (schemaOrHandler: unknown, handler?: (input: unknown) => unknown) =>
    Object.assign(
      (input?: unknown) => {
        const schema = schemaOrHandler as { parse: (input: unknown) => unknown };
        return Promise.resolve(
          handler ? handler(schema.parse(input)) : (schemaOrHandler as () => unknown)(),
        );
      },
      { __: { type: "query" } },
    ),
  form: (_schema: unknown, handler?: object) =>
    Object.assign(handler ?? (_schema as object), { __: { type: "form" } }),
  command: (_schema: unknown, handler: object) =>
    Object.assign(handler, { __: { type: "command" } }),
  getRequestEvent: () => ({ locals: { validate: mocks.validate } }),
  requested: () => ({ refreshAll: vi.fn() }),
}));
vi.mock("$app/env/private", () => ({ S3_BUCKET: "test" }));
vi.mock("#lib/server/s3.js", () => ({ s3: {} }));
vi.mock("#lib/server/auth/session.js", () => ({}));
vi.mock("#lib/server/database/db.js", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  return { default: drizzle(createClient({ url: ":memory:" })) };
});

import db from "#lib/server/database/db.js";
import { users, uploads, sessions, invites } from "#lib/server/database/schema.js";
import { getFiles } from "#lib/api/files.remote.js";
import { getInvites } from "#lib/api/invites.remote.js";
import { getKeys } from "#lib/api/keys.remote.js";
import { getUsers } from "#lib/api/users.remote.js";
import { parsePage } from "#lib/pagination.js";

beforeAll(async () => {
  await db.run(
    sql`CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, password TEXT, created_at INTEGER, created_ip TEXT, admin INTEGER, invite TEXT)`,
  );
  await db.run(
    sql`CREATE TABLE uploads (id TEXT PRIMARY KEY, label TEXT, created_at INTEGER, created_ip TEXT, created_by_user TEXT, expire_at INTEGER, bytes INTEGER)`,
  );
  await db.run(sql`CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER)`);
  await db.run(
    sql`CREATE TABLE invites (id TEXT PRIMARY KEY, label TEXT, created_at INTEGER, used_by TEXT)`,
  );
});

beforeEach(async () => {
  for (const table of [users, uploads, sessions, invites]) await db.delete(table);
  await db.insert(users).values([
    { id: "one", username: "one", password: "private-hash", createdAt: new Date() },
    { id: "two", username: "two", password: "private-hash", createdAt: new Date() },
  ]);
  mocks.validate.mockResolvedValue({
    authenticated: true,
    user: { id: "one", admin: true },
    session: { id: "current" },
  });
});

describe("remote page queries", () => {
  it("scopes search and pagination to the current user's completed uploads", async () => {
    await db.insert(uploads).values(
      Array.from({ length: 27 }, (_, i) => ({
        id: `file-${i.toString().padStart(2, "0")}`,
        label: "Photo",
        bytes: i,
        createdAt: new Date(),
        createdIp: "127.0.0.1",
        createdByUser: "one",
        expireAt: new Date(),
      })),
    );
    await db.insert(uploads).values([
      {
        id: "private-other-file",
        label: "Photo",
        bytes: 1,
        createdAt: new Date(),
        createdIp: "127.0.0.1",
        createdByUser: "two",
        expireAt: new Date(),
      },
      {
        id: "unfinished",
        label: "Photo",
        createdAt: new Date(),
        createdIp: "127.0.0.1",
        createdByUser: "one",
        expireAt: new Date(),
      },
    ]);
    const result = await getFiles({ page: 999, search: "Photo", order: "sizeas" });

    expect(result).toMatchObject({
      page: 2,
      lastPage: 2,
      orderDisplay: { column: "size", direction: "asc" },
    });

    expect(result.files.map((file) => file.id)).toEqual(["file-25", "file-26"]);
    expect((await getFiles({ page: 1, search: "other", order: "invalid" })).files).toEqual([]);
  });

  it("returns only the user's session summaries and marks the current one", async () => {
    await db.insert(sessions).values([
      { id: "current", userId: "one", expiresAt: 100 },
      { id: "other", userId: "two", expiresAt: 100 },
    ]);

    expect(await getKeys()).toEqual({ sessions: [{ expiresAt: 100, current: true }] });
  });

  it("counts user pages correctly at exact page boundaries and clamps requests", async () => {
    await db.insert(users).values(
      Array.from({ length: 13 }, (_, i) => ({
        id: `extra-${i}`,
        username: `extra-${i}`,
        password: "private-hash",
        createdAt: new Date(),
      })),
    );
    const result = await getUsers(999);

    expect(result).toMatchObject({ page: 1, lastPage: 1 });
    expect(result.rows).toHaveLength(15);
    expect(JSON.stringify(result)).not.toContain("private-hash");
  });

  it("restricts admin queries independently of layout rendering", async () => {
    mocks.validate.mockResolvedValue({ authenticated: true, user: { id: "one", admin: false } });
    await expect(getUsers(1)).rejects.toMatchObject({ location: "/files" });
    await expect(getInvites()).rejects.toMatchObject({ location: "/login" });
  });

  it("redirects unauthenticated queries before reading data", async () => {
    mocks.validate.mockResolvedValue({ authenticated: false });
    for (const request of [
      () => getFiles({ page: 1, search: "", order: "datede" }),
      () => getKeys(),
      () => getInvites(),
      () => getUsers(1),
    ]) {
      await expect(request()).rejects.toMatchObject({ location: expect.any(String) });
    }
  });

  it("normalizes malformed pagination before forming query cache keys", () => {
    for (const value of [null, "", "invalid", "-1", "1.2", "1000001"])
      expect(parsePage(value)).toBe(1);
    expect(parsePage("2")).toBe(2);
  });
});
