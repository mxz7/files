import { form, getRequestEvent, requested, query } from "$app/server";
import {
  createSession,
  deleteSessionCookie,
  generateSessionToken,
  invalidateUserSessions,
} from "#lib/server/auth/session.js";
import { getAuthedUser } from "./auth.remote.js";
import { error, redirect } from "@sveltejs/kit";
import db from "#lib/server/database/db.js";
import { sessions } from "#lib/server/database/schema.js";
import { asc, eq } from "drizzle-orm";
import dayjs from "dayjs";
import { z } from "zod";

export const createKey = form(z.object({ days: z.number().min(1).max(700) }), async ({ days }) => {
  const auth = await getRequestEvent().locals.validate();

  if (!auth.authenticated) error(401, "Unauthorized");

  const token = generateSessionToken();
  await createSession(token, auth.user.id, dayjs().add(days, "day").toDate());

  await requested(getKeys, 1).refreshAll();

  return token;
});

export const deleteKeys = form(async () => {
  const { locals, cookies } = getRequestEvent();
  const auth = await locals.validate();

  if (!auth.authenticated) error(401, "Unauthorized");

  await invalidateUserSessions(auth.user.id);
  deleteSessionCookie(cookies);
  locals.auth = { authenticated: false };
  locals.authedUser = undefined;
  getAuthedUser().set(null);
  redirect(303, "/");
});

export const getKeys = query(async () => {
  const auth = await getRequestEvent().locals.validate();

  if (!auth.authenticated) redirect(303, "/login");

  const rows = await db
    .select({ id: sessions.id, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.userId, auth.user.id))
    .orderBy(asc(sessions.expiresAt));
  return {
    sessions: rows.map((session) => ({
      expiresAt: session.expiresAt,
      current: session.id === auth.session.id,
    })),
  };
});
