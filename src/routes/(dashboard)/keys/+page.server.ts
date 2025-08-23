import db from "$lib/server/database/db";
import { sessions as sessionTable } from "$lib/server/database/schema.js";
import { lucia } from "$lib/server/lucia.js";
import { redirect } from "@sveltejs/kit";
import dayjs from "dayjs";
import { asc, eq } from "drizzle-orm";
import { fail, message, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { z } from "zod";

const createSessionSchema = z.object({
  days: z.number().min(1).max(700),
});

export async function load({ parent }) {
  const { auth } = await parent();

  if (!auth.authenticated) return redirect(302, "/files");

  const sessions = await db
    .select({
      id: sessionTable.id,
      expiresAt: sessionTable.expiresAt,
    })
    .from(sessionTable)
    .orderBy(asc(sessionTable.expiresAt));

  return {
    sessions: sessions.map((s) => ({ expiresAt: s.expiresAt, current: s.id === auth.session.id })),
    form: await superValidate(zod(createSessionSchema)),
  };
}

export const actions = {
  delete: async ({ locals }) => {
    const auth = await locals.validate();

    if (!auth.authenticated) {
      return redirect(302, "/login");
    }

    await db.delete(sessionTable).where(eq(sessionTable.userId, auth.user.id));

    return redirect(302, "/");
  },
  create: async ({ locals, request }) => {
    const auth = await locals.validate();

    if (!auth.authenticated) {
      return redirect(302, "/login");
    }

    const form = await superValidate(request, zod(createSessionSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const session = await lucia.createSession(auth.user.id, {});

    await db
      .update(sessionTable)
      .set({ expiresAt: dayjs().add(form.data.days, "day").unix() })
      .where(eq(sessionTable.id, session.id));

    return message(form, session.id);
  },
};
