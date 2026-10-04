# files.maxz.dev

SvelteKit 3 application, deployed with adapter-node 6 on Node.js 24.

## Development

Install dependencies with `pnpm install`, then run `pnpm dev`.

Configure `DB_URL`, `DB_TOKEN`, `CRON_SECRET`, `S3_BUCKET`, `S3_ENDPOINT`,
`S3_KEY_ID`, and `S3_ACCESS_KEY` in `.env` or the runtime environment. These
values must be nonempty when the app starts; builds do not need credentials.

The production origin is `https://files.maxz.dev`, configured with `paths.origin`
in `vite.config.ts`. Development uses the request origin. Adapter-node no longer
uses the `ORIGIN` environment variable.

Page data and forms use SvelteKit remote functions in `src/lib/api/*.remote.ts`, with Zod
validation and authorization in each handler. Login and signup also work without
JavaScript. Sensitive form fields use an underscore prefix to avoid echoing them
back after failed submissions.

## Uploads

Uploads use `src/lib/api/uploads.remote.ts`: create a signed upload grant, PUT the
file directly to the presigned S3 URL, then finalize it. Grants expire after 15
minutes and bind the upload to its user, content type, byte length, and expiry.
Finalization checks the object and publishes it only after processing. Upload
commands accept session cookies or bearer session keys. The old `/api/upload`
endpoint has been removed.

Supported raster images follow HRCT's gallery processing: Sharp verifies the
format, applies EXIF orientation, and re-encodes to WebP without metadata. Original
dimensions are preserved. Images are limited to 50 MB and 50 million decoded
pixels; animated and multipage images are rejected. Other files retain the 1 GB
limit, and supported videos retain EXIFTool metadata stripping.

The bucket must allow browser CORS requests from `https://files.maxz.dev` with
method `PUT` and header `Content-Type` (also allow the local development origin
when testing). Staging objects use the `_pending/` prefix. Block public access to
that prefix and configure a one-day lifecycle expiration to remove abandoned
uploads. Completed and failed uploads are cleaned up by the app.

## Authentication

Authentication follows the session helpers in `~/dev/hrct`, without Lucia.
Sessions use random 160-bit tokens and store only their SHA-256 hashes. Browser
sessions expire after 30 days and renew in their final 15 days; bearer keys retain
the expiry selected when created. Cookies are HttpOnly, SameSite=Lax, and Secure
in production. Existing Lucia tokens upgrade to hashed storage when used, with no
database migration required. Public user data excludes password hashes.

## Logging

Production requests and errors produce structured Pino logs with a request ID,
status, duration, client address, and authenticated user ID when available.
Unexpected errors receive an error ID; their details stay in server logs.
Access logs omit request and referrer query strings, authentication headers, and request bodies.
HTTP logging is silent during development and builds.

Logs go to stdout by default. Set all three of `LOKI_HOST`, `LOKI_USERNAME`, and
`LOKI_PASSWORD` to send logs to Loki instead, with `service_name="files"`.
Optionally set `LOKI_TENANT_ID` for Loki's `X-Scope-OrgID` header (for example,
`nypsi` to use the same tenant as nypsi-website).

## Checks

- `pnpm check` — Svelte and TypeScript checks
- `pnpm test` — logging, environment validation, session security, remote queries, uploads, and remote form authorization tests
- `pnpm lint` — formatting checks
- `pnpm build` — production build
