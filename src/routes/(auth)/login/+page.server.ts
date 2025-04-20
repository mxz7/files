import { loginSchema } from "$lib/schema/auth.js";
import db from "$lib/server/database/db.js";
import { users } from "$lib/server/database/schema.js";
import { lucia } from "$lib/server/lucia.js";
import { verify } from "@node-rs/argon2";
import { fail, redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { message, setError, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";

export async function load({ locals }) {
  const auth = await locals.validate();

  if (auth.authenticated) return redirect(302, "/files");

  const form = await superValidate(zod(loginSchema));

  return { form };
}

export const actions = {
  login: async ({ request, cookies }) => {
    const form = await superValidate(request, zod(loginSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const user = await db
      .select({ userId: users.id, password: users.password })
      .from(users)
      .where(eq(users.username, form.data.username))
      .then((r) => r[0]);

    if (!user) {
      return setError(form, "password", "Invalid credentials.");
    }

    const passwordCheck = await verify(user.password, form.data.password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    if (!passwordCheck) {
      return setError(form, "password", "Invalid credentials.");
    }

    const session = await lucia.createSession(user.userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: ".",
      ...sessionCookie.attributes,
    });

    return message(form, "ok");
  },
};
