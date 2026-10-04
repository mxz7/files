import { lucia } from "#lib/server/lucia.js";
import { redirect } from "@sveltejs/kit";

export async function GET({ cookies }) {
  const sessionId = cookies.get(lucia.sessionCookieName);

  if (!sessionId) return redirect(302, "/");
  await lucia.invalidateSession(sessionId);

  return redirect(302, "/");
}
