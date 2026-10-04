import {
  deleteSessionCookie,
  getSessionCookie,
  setSessionCookie,
  validateSession,
} from "#lib/server/auth/session.js";
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
  event.locals.auth = { authenticated: false };
  const token = getSessionCookie(event.cookies);
  if (token) {
    const auth = await validateSession(token);
    if (auth) {
      event.locals.auth = { authenticated: true, ...auth };
      event.locals.authedUser = auth.user;
      setSessionCookie(event.cookies, token, new Date(auth.session.expiresAt * 1000));
    } else {
      deleteSessionCookie(event.cookies);
    }
  }
  event.locals.validate = async () => event.locals.auth;

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
