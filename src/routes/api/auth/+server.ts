import { lucia } from "#lib/server/lucia.js";

export async function GET({ cookies, locals }) {
  const sessionId = cookies.get(lucia.sessionCookieName);
  if (!sessionId) {
    return Response.json({ authenticated: false });
  }

  const { session, user } = await lucia.validateSession(sessionId);
  if (session && session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    // sveltekit types deviates from the de-facto standard
    // you can use 'as any' too
    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: ".",
      ...sessionCookie.attributes,
    });
  }
  if (!session) {
    const sessionCookie = lucia.createBlankSessionCookie();
    cookies.set(sessionCookie.name, sessionCookie.value, {
      path: ".",
      ...sessionCookie.attributes,
    });
  }

  if (!user || !session) {
    return Response.json({ authenticated: false });
  }
  locals.authedUser = user;
  return Response.json({ authenticated: true, user, session });
}
