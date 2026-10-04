import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import type { Cookies } from "@sveltejs/kit";

vi.mock("$app/env", () => ({ dev: true }));
vi.mock("#lib/server/database/db.js", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  return { default: drizzle(createClient({ url: ":memory:" })) };
});

import db from "#lib/server/database/db.js";
import { sessions, users } from "#lib/server/database/schema.js";
import {
  createSession,
  generateSessionToken,
  validateSession,
  invalidateSession,
  invalidateUserSessions,
  setSessionCookie,
  deleteSessionCookie,
} from "#lib/server/auth/session.js";

beforeAll(async () => {
  await db.run(
    sql`CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, password TEXT, created_at INTEGER, created_ip TEXT, admin INTEGER, invite TEXT)`,
  );
  await db.run(sql`CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER)`);
});
beforeEach(async () => {
  await db.delete(sessions);
  await db.delete(users);
  await db.insert(users).values([
    {
      id: "one",
      username: "one",
      password: "private-password-hash",
      createdAt: new Date(),
      admin: true,
    },
    { id: "two", username: "two", password: "private-password-hash", createdAt: new Date() },
  ]);
});

describe("session tokens", () => {
  it("stores a hash and returns only public user data", async () => {
    const token = generateSessionToken();
    const session = await createSession(token, "one");
    expect(token).toMatch(/^[a-f0-9]{40}$/);
    expect(session.id).toMatch(/^[a-f0-9]{64}$/);
    expect(session.id).not.toBe(token);
    expect((await validateSession(token))?.user).toEqual({
      id: "one",
      username: "one",
      admin: true,
    });
    expect(await validateSession(session.id)).toBeNull();
    expect(await validateSession("invalid")).toBeNull();
  });
  it("deletes expired sessions", async () => {
    const token = generateSessionToken();
    await createSession(token, "one", new Date(Date.now() - 1000));
    expect(await validateSession(token)).toBeNull();
    expect(await db.select().from(sessions)).toEqual([]);
  });
  it("renews browser sessions but preserves the expiry of bearer keys", async () => {
    const token = generateSessionToken();
    const expiry = new Date(Date.now() + 86400000);
    const original = await createSession(token, "one", expiry);
    expect((await validateSession(token, { refresh: false }))?.session.expiresAt).toBe(
      original.expiresAt,
    );
    expect((await validateSession(token))?.session.expiresAt).toBeGreaterThan(
      original.expiresAt + 28 * 86400,
    );
  });
  it("upgrades legacy raw tokens without changing their bearer expiry", async () => {
    const token = "a".repeat(40);
    const expiresAt = Math.floor(Date.now() / 1000) + 86400;
    await db.insert(sessions).values({ id: token, userId: "one", expiresAt });
    const result = await validateSession(token, { refresh: false });
    expect(result?.session.id).toHaveLength(64);
    expect(result?.session.expiresAt).toBe(expiresAt);
    expect(await db.select().from(sessions)).toEqual([result?.session]);
    expect(await validateSession(token, { refresh: false })).toEqual(result);
  });
  it("revokes individual sessions and only the selected user's sessions", async () => {
    const first = await createSession(generateSessionToken(), "one");
    await createSession(generateSessionToken(), "one");
    const other = await createSession(generateSessionToken(), "two");
    await invalidateSession(first.id);
    expect(await db.select().from(sessions)).toHaveLength(2);
    await invalidateUserSessions("one");
    expect(await db.select().from(sessions)).toEqual([other]);
  });
  it("sets protected cookies and deletes them on the same path", () => {
    const cookies = { set: vi.fn(), delete: vi.fn() };
    const expiry = new Date();
    setSessionCookie(cookies as unknown as Cookies, "token", expiry);
    expect(cookies.set).toHaveBeenCalledWith("auth_session", "token", {
      httpOnly: true,
      path: "/",
      secure: false,
      sameSite: "lax",
      expires: expiry,
    });
    deleteSessionCookie(cookies as unknown as Cookies);
    expect(cookies.delete).toHaveBeenCalledWith("auth_session", { path: "/" });
  });
});
