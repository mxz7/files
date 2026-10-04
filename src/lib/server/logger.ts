import { building, dev } from "$app/env";
import { LOKI_HOST, LOKI_PASSWORD, LOKI_TENANT_ID, LOKI_USERNAME } from "$app/env/private";
import type { RequestEvent } from "@sveltejs/kit";
import pino from "pino";
import type { LokiOptions } from "pino-loki";

function buildTransport() {
  if (dev || building || !LOKI_HOST || !LOKI_USERNAME || !LOKI_PASSWORD) return undefined;

  return pino.transport<LokiOptions>({
    target: "pino-loki",
    options: {
      host: LOKI_HOST,
      basicAuth: { username: LOKI_USERNAME, password: LOKI_PASSWORD },
      labels: { service_name: "files" },
      headers: LOKI_TENANT_ID ? { "X-Scope-OrgID": LOKI_TENANT_ID } : undefined,
    },
  });
}

export const baseLogger = pino({ base: undefined }, buildTransport());

function requestContext(event: RequestEvent) {
  // Read the actual request, including when called from a remote query.
  const url = new URL(event.request.url);
  const remoteAction = url.searchParams.get("/remote");
  const remoteId = event.isRemoteRequest ? url.pathname.split("/remote/")[1] : remoteAction;
  let referer: string | undefined;

  try {
    const value = event.request.headers.get("referer");
    if (value) {
      const referrerUrl = new URL(value);
      referer =
        referrerUrl.origin === url.origin
          ? referrerUrl.pathname
          : referrerUrl.origin + referrerUrl.pathname;
    }
  } catch {
    // Invalid referrers must not break request handling.
  }

  let address: string | undefined;
  try {
    address = event.getClientAddress();
  } catch {
    // Some adapters and prerendering do not provide a client address.
  }

  return {
    method: event.request.method,
    // Query strings can contain tokens or serialized remote arguments.
    path: url.pathname,
    remote_function: remoteId?.split("/")[1] || undefined,
    elapsed:
      event.locals.startTimer === undefined
        ? undefined
        : performance.now() - event.locals.startTimer,
    ip_address: address,
    user_agent: event.request.headers.get("user-agent") || "",
    referer,
    user_id: event.locals.authedUser?.id,
  };
}

export function logRequest(statusCode: number, event: RequestEvent) {
  if (dev || building) return;

  const logData = { ...requestContext(event), event_type: "request", status: statusCode };
  const logger = event.locals.logger || baseLogger;
  if (statusCode >= 500) logger.error(logData);
  else if (statusCode >= 400) logger.warn(logData);
  else logger.info(logData);
}

export function logError(
  statusCode: number,
  kind: "app" | "framework" | "validation" | "unknown",
  event: RequestEvent,
  validationIssueCount?: number,
) {
  if (dev || building) return;

  const logData = {
    ...requestContext(event),
    event_type: "error",
    status: statusCode,
    error_kind: kind,
    error: event.locals.error,
    error_id: event.locals.errorId,
    error_stack_trace: event.locals.errorStackTrace,
    validation_issue_count: validationIssueCount,
  };
  const logger = event.locals.logger || baseLogger;
  if (statusCode >= 500) logger.error(logData);
  else logger.warn(logData);
}
