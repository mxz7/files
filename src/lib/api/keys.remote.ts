import { form, getRequestEvent } from "$app/server";
import db from "#lib/server/database/db.js";
import { sessions } from "#lib/server/database/schema.js";
import { lucia } from "#lib/server/lucia.js";
import { error, redirect } from "@sveltejs/kit";
import dayjs from "dayjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const createKey = form(z.object({ days: z.number().min(1).max(700) }), async ({ days }) => {
  const auth = await getRequestEvent().locals.validate(false);
  if (!auth.authenticated) error(401, "Unauthorized");

  const session = await lucia.createSession(auth.user.id, {});
  await db
    .update(sessions)
    .set({ expiresAt: dayjs().add(days, "day").unix() })
    .where(eq(sessions.id, session.id));

  return session.id;
});

export const deleteKeys = form(async () => {
  const { locals, cookies } = getRequestEvent();
  const auth = await locals.validate(false);
  if (!auth.authenticated) error(401, "Unauthorized");

  await lucia.invalidateUserSessions(auth.user.id);
  const cookie = lucia.createBlankSessionCookie();
  cookies.set(cookie.name, cookie.value, { path: "/", ...cookie.attributes });
  redirect(303, "/");
});
