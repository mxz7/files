import { lucia } from "#lib/server/lucia.js";
import { baseLogger, logError, logRequest } from "#lib/server/logger.js";
import type { Handle, HandleServerError } from "@sveltejs/kit/hooks";

export const handleError: HandleServerError = ({ event, error, kind, issues }) => {
  const requestId = event.locals.logger?.bindings().requestId;
  if (kind !== "unknown") {
    event.locals.error = error.message;
    event.locals.errorId = kind === "app" ? error.errorId : undefined;
    event.locals.errorStackTrace = undefined;
    logError(error.status, kind, event, kind === "validation" ? issues.length : undefined);
    return { ...error, requestId };
  }

  const errorId = crypto.randomUUID();
  event.locals.error = String(error);
  event.locals.errorId = errorId;
  event.locals.errorStackTrace = error instanceof Error ? error.stack : undefined;
  logError(500, kind, event);

  return { message: "An unexpected error occurred", errorId, requestId };
};

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.startTimer = performance.now();
  event.locals.logger = baseLogger.child({ requestId: crypto.randomUUID() });
  // if (!dev && !event.isSubRequest && event.url.pathname.startsWith("/api")) {
  //   const rateLimitAttempt = await rateLimiter.limit(event.getClientAddress()).catch(() => {
  //     return { success: true, reset: 69 };
  //   });

  //   if (!rateLimitAttempt.success) {
  //     const timeRemaining = Math.floor((rateLimitAttempt.reset - new Date().getTime()) / 1000);
  //     return new Response(
  //       JSON.stringify({
  //         message: `Too many requests. Please try again in ${timeRemaining} seconds.`,
  //         error: 429,
  //         status: 429,
  //       }),
  //       {
  //         status: 429,
  //         headers: {
  //           "cache-control": `max-age=${timeRemaining * 2}`,
  //         },
  //       },
  //     );
  //   }
  // }

  event.locals.validate = async (useApi = true) => {
    if (event.cookies.getAll().length === 0) return { authenticated: false };
    if (event.request.headers.get("user-agent")?.toLowerCase().includes("bot"))
      return { authenticated: false };
    if (useApi) {
      const res = await event.fetch("/api/auth").then((r) => r.json());
      const { user, session } = res;

      if (!user || !session) return { authenticated: false };

      event.locals.authedUser = user;
      return { user, session, authenticated: true };
    } else {
      const sessionId = event.cookies.get(lucia.sessionCookieName);
      if (!sessionId) {
        return { authenticated: false };
      }

      const { session, user } = await lucia.validateSession(sessionId);
      if (session && session.fresh) {
        const sessionCookie = lucia.createSessionCookie(session.id);
        // sveltekit types deviates from the de-facto standard
        // you can use 'as any' too
        event.cookies.set(sessionCookie.name, sessionCookie.value, {
          path: ".",
          ...sessionCookie.attributes,
        });
      }
      if (!session) {
        const sessionCookie = lucia.createBlankSessionCookie();
        event.cookies.set(sessionCookie.name, sessionCookie.value, {
          path: ".",
          ...sessionCookie.attributes,
        });
      }

      if (!user || !session) {
        return { authenticated: false };
      }
      event.locals.authedUser = user;
      return { user, session, authenticated: true };
    }
  };

  const res = await resolve(event);

  try {
    if (
      (res.redirected || res.status === 404 || res.status === 500) &&
      res.headers.get("cache-control")
    )
      res.headers.delete("cache-control");
  } catch {
    // do nothing lol
  }

  logRequest(res.status, event);

  return res;
};
