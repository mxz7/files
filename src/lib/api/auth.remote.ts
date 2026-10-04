import { form, getRequestEvent, query } from "$app/server";
import { loginSchema, signupSchema } from "#lib/schema/auth.js";
import { nanoid } from "#lib/nanoid.js";
import db from "#lib/server/database/db.js";
import { invites, users } from "#lib/server/database/schema.js";
import {
  createSession,
  deleteSessionCookie,
  generateSessionToken,
  invalidateSession,
  setSessionCookie,
} from "#lib/server/auth/session.js";
import { hash, verify } from "@node-rs/argon2";
import { invalid, redirect } from "@sveltejs/kit";
import { and, eq, isNull } from "drizzle-orm";

export const login = form(loginSchema, async (data, issue) => {
  const { cookies, locals } = getRequestEvent();
  const user = await db
    .select({
      userId: users.id,
      password: users.password,
      username: users.username,
      admin: users.admin,
    })
    .from(users)
    .where(eq(users.username, data.username))
    .then((r) => r[0]);

  if (!user) {
    invalid(issue._password("Invalid credentials."));
  }

  const passwordCheck = await verify(user.password, data._password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  if (!passwordCheck) {
    invalid(issue._password("Invalid credentials."));
  }

  const token = generateSessionToken();
  const session = await createSession(token, user.userId);
  setSessionCookie(cookies, token, new Date(session.expiresAt * 1000));
  locals.authedUser = { id: user.userId, username: user.username, admin: !!user.admin };
  locals.auth = { authenticated: true, session, user: locals.authedUser };
  getAuthedUser().set(locals.authedUser);

  redirect(303, "/files");
});

export const signup = form(signupSchema, async (data, issue) => {
  const { cookies, locals } = getRequestEvent();
  const inviteCheck = await db
    .select({ id: invites.id })
    .from(invites)
    .where(and(eq(invites.id, data._invite), isNull(invites.usedBy)))
    .then((r) => r[0]);

  if (!inviteCheck) {
    invalid(issue._invite("Invalid invite."));
  }

  const usernameCheck = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.username, data.username))
    .then((r) => r[0]);

  if (usernameCheck) {
    invalid(issue.username("Invalid username."));
  }

  const userId = nanoid();
  const passwordHash = await hash(data._password, {
    // recommended minimum parameters
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  await db.insert(users).values({
    createdAt: new Date(),
    id: userId,
    username: data.username,
    password: passwordHash,
    invite: data._invite,
  });

  await db.update(invites).set({ usedBy: userId }).where(eq(invites.id, data._invite));

  const token = generateSessionToken();
  const session = await createSession(token, userId);
  setSessionCookie(cookies, token, new Date(session.expiresAt * 1000));
  locals.authedUser = { id: userId, username: data.username, admin: false };
  locals.auth = { authenticated: true, session, user: locals.authedUser };
  getAuthedUser().set(locals.authedUser);

  redirect(303, "/files");
});

export const getAuthedUser = query(async () => {
  const auth = await getRequestEvent().locals.validate();
  return auth.authenticated ? auth.user : null;
});

export const logout = form(async () => {
  const { locals, cookies } = getRequestEvent();
  const auth = await locals.validate();

  if (auth.authenticated) await invalidateSession(auth.session.id);
  deleteSessionCookie(cookies);
  locals.auth = { authenticated: false };
  locals.authedUser = undefined;
  getAuthedUser().set(null);
  redirect(303, "/");
});

export const requireAuth = query(async () => {
  const user = await getAuthedUser();
  if (!user) redirect(303, "/login");

  return user;
});

export const requireGuest = query(async () => {
  if (await getAuthedUser()) redirect(303, "/files");
  return null;
});
