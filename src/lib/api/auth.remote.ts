import { form, getRequestEvent } from "$app/server";
import { loginSchema, signupSchema } from "#lib/schema/auth.js";
import { nanoid } from "#lib/nanoid.js";
import db from "#lib/server/database/db.js";
import { invites, users } from "#lib/server/database/schema.js";
import { lucia } from "#lib/server/lucia.js";
import { hash, verify } from "@node-rs/argon2";
import { invalid, redirect } from "@sveltejs/kit";
import { and, eq, isNull } from "drizzle-orm";

export const login = form(loginSchema, async (data, issue) => {
  const { cookies } = getRequestEvent();
  const user = await db
    .select({ userId: users.id, password: users.password })
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

  const session = await lucia.createSession(user.userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies.set(sessionCookie.name, sessionCookie.value, {
    path: ".",
    ...sessionCookie.attributes,
  });

  redirect(303, "/files");
});

export const signup = form(signupSchema, async (data, issue) => {
  const { cookies } = getRequestEvent();
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

  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies.set(sessionCookie.name, sessionCookie.value, {
    path: ".",
    ...sessionCookie.attributes,
  });

  redirect(303, "/files");
});
