import { deleteSessionCookie, invalidateSession } from "#lib/server/auth/session.js";
import { redirect } from "@sveltejs/kit";

export async function GET({ locals, cookies }) {
  const auth = await locals.validate();
  if (auth.authenticated) await invalidateSession(auth.session.id);
  deleteSessionCookie(cookies);
  redirect(302, "/");
}
