import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestEvent } from "@sveltejs/kit";

const { logError, logRequest, logger, session } = vi.hoisted(() => ({
  logError: vi.fn(),
  logRequest: vi.fn(),
  logger: { bindings: () => ({ requestId: "request-1" }) },
  session: {
    getSessionCookie: vi.fn(),
    validateSession: vi.fn(),
    setSessionCookie: vi.fn(),
    deleteSessionCookie: vi.fn(),
  },
}));
vi.mock("#lib/server/auth/session.js", () => session);
vi.mock("#lib/server/logger.js", () => ({
  baseLogger: { child: () => logger },
  logError,
  logRequest,
}));
import { handle, handleError } from "../src/hooks.server";

function event() {
  return { locals: { logger } } as unknown as RequestEvent;
}

describe("error handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves expected statuses and app error IDs", () => {
    const request = event();
    const error = { status: 401, message: "Unauthorized", errorId: "app-error" };
    expect(handleError({ kind: "app", error, event: request })).toEqual({
      ...error,
      requestId: "request-1",
    });
    expect(logError).toHaveBeenCalledWith(401, "app", request, undefined);
  });

  it("logs validation issue counts without their values", () => {
    const request = event();
    const error = { status: 400, message: "Bad Request" };
    const result = handleError({
      kind: "validation",
      error,
      event: request,
      issues: [{ message: "private-value" }],
    });
    expect(result).toEqual({ ...error, requestId: "request-1" });
    expect(logError).toHaveBeenCalledWith(400, "validation", request, 1);
    expect(request.locals.error).toBe("Bad Request");
  });

  it("keeps unexpected details in logs and exposes correlation IDs", () => {
    const request = event();
    const error = new Error("private internal detail");
    const result = handleError({ kind: "unknown", error, event: request });
    expect(result).toMatchObject({
      message: "An unexpected error occurred",
      requestId: "request-1",
      errorId: expect.any(String),
    });
    expect(JSON.stringify(result)).not.toContain("private internal detail");
    expect(request.locals.errorStackTrace).toBe(error.stack);
    expect(logError).toHaveBeenCalledWith(500, "unknown", request);
  });
});

describe("request authentication", () => {
  beforeEach(() => vi.resetAllMocks());

  it("validates once before rendering and shares public auth through locals", async () => {
    const auth = {
      session: { id: "hash", expiresAt: 2000000000 },
      user: { id: "user", username: "user", admin: false },
    };
    session.getSessionCookie.mockReturnValue("token");
    session.validateSession.mockResolvedValue(auth);
    const request = { locals: {}, cookies: {} } as unknown as RequestEvent;
    const resolve = vi.fn(async () => {
      expect(await request.locals.validate()).toEqual({ authenticated: true, ...auth });
      expect(await request.locals.validate()).toEqual({ authenticated: true, ...auth });
      expect(session.setSessionCookie).toHaveBeenCalledWith(
        request.cookies,
        "token",
        new Date(2000000000000),
      );
      return new Response("ok");
    });
    await handle({ event: request, resolve });
    expect(session.validateSession).toHaveBeenCalledTimes(1);
    expect(request.locals.authedUser).toEqual(auth.user);
  });

  it("clears invalid cookies and renders as unauthenticated", async () => {
    session.getSessionCookie.mockReturnValue("invalid-token");
    session.validateSession.mockResolvedValue(null);
    const request = { locals: {}, cookies: {} } as unknown as RequestEvent;
    await handle({ event: request, resolve: async () => new Response("ok") });
    expect(await request.locals.validate()).toEqual({ authenticated: false });
    expect(session.deleteSessionCookie).toHaveBeenCalledWith(request.cookies);
    expect(session.setSessionCookie).not.toHaveBeenCalled();
  });
});
