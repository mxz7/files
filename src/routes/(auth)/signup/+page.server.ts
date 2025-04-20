import { nanoid } from "$lib/nanoid.js";
import { signupSchema } from "$lib/schema/auth.js";
import db from "$lib/server/database/db.js";
import { invites, users } from "$lib/server/database/schema.js";
import { lucia } from "$lib/server/lucia.js";
import { hash } from "@node-rs/argon2";
import { fail, redirect } from "@sveltejs/kit";
import { and, eq, isNull } from "drizzle-orm";
import { message, setError, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";

export async function load({ locals }) {
  const auth = await locals.validate();

  if (auth.authenticated) return redirect(302, "/files");

  const form = await superValidate(zod(signupSchema));

  return { form };
}

export const actions = {
  signup: async ({ request, cookies }) => {
    const form = await superValidate(request, zod(signupSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const inviteCheck = await db
      .select({ id: invites.id })
      .from(invites)
      .where(and(eq(invites.id, form.data.invite), isNull(invites.usedBy)))
      .then((r) => r[0]);

    if (!inviteCheck) {
      return setError(form, "invite", "Invalid invite.");
    }

    const usernameCheck = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.username, form.data.username))
      .then((r) => r[0]);

    if (usernameCheck) {
      return setError(form, "username", "Invalid username.");
    }

    const userId = nanoid();
    const passwordHash = await hash(form.data.password, {
      // recommended minimum parameters
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    await db.insert(users).values({
      createdAt: new Date(),
      id: userId,
      username: form.data.username,
      password: passwordHash,
      invite: form.data.invite,
    });

    await db.update(invites).set({ usedBy: userId }).where(eq(invites.id, form.data.invite));

    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: ".",
      ...sessionCookie.attributes,
    });

    return message(form, "ok");
  },
};
