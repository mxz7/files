import { dev } from "$app/env";
import type { Cookies } from "@sveltejs/kit";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import db from "#lib/server/database/db.js";
import { sessions, users } from "#lib/server/database/schema.js";
import type { Session, User } from "#lib/types/auth.js";

const SESSION_TTL = 60 * 60 * 24 * 30;
const RENEWAL_WINDOW = 60 * 60 * 24 * 15;
const COOKIE_NAME = "auth_session";

function sessionId(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken() {
  return randomBytes(20).toString("hex");
}

export async function createSession(
  token: string,
  userId: string,
  expiresAt = new Date(Date.now() + SESSION_TTL * 1000),
): Promise<Session> {
  const session = {
    id: sessionId(token),
    userId,
    expiresAt: Math.floor(expiresAt.getTime() / 1000),
  };
  await db.insert(sessions).values(session);
  return session;
}

export async function validateSession(
  token: string,
  { refresh = true } = {},
): Promise<{ session: Session; user: User } | null> {
  // Both the new tokens and legacy Lucia tokens are 40 characters. A stored hash
  // is never accepted as a bearer credential.
  if (!/^[a-z0-9]{40}$/.test(token)) return null;
  const id = sessionId(token);

  async function find(id: string) {
    return db
      .select({
        session: sessions,
        user: { id: users.id, username: users.username, admin: users.admin },
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, id))
      .limit(1)
      .then((rows) => rows[0]);
  }

  // Upgrade existing cookie/API tokens on use, without forcing everyone to log in.
  const result = (await find(id)) ?? (await find(token));
  if (!result) return null;

  const now = Math.floor(Date.now() / 1000);
  if (now >= result.session.expiresAt) {
    await invalidateSession(result.session.id);
    return null;
  }

  if (result.session.id !== id) {
    await db.update(sessions).set({ id }).where(eq(sessions.id, result.session.id));
    result.session.id = id;
  }

  if (refresh && now >= result.session.expiresAt - RENEWAL_WINDOW) {
    result.session.expiresAt = now + SESSION_TTL;
    await db
      .update(sessions)
      .set({ expiresAt: result.session.expiresAt })
      .where(eq(sessions.id, id));
  }

  return { session: result.session, user: { ...result.user, admin: !!result.user.admin } };
}

export async function invalidateSession(id: string) {
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function invalidateUserSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
  cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    secure: !dev,
    sameSite: "lax",
    expires: expiresAt,
  });
}

export function getSessionCookie(cookies: Cookies) {
  return cookies.get(COOKIE_NAME);
}

export function deleteSessionCookie(cookies: Cookies) {
  cookies.delete(COOKIE_NAME, { path: "/" });
}
