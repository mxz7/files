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

Forms use SvelteKit remote functions in `src/lib/api/*.remote.ts`, with Zod
validation and authorization in each handler. Login and signup also work without
JavaScript. Sensitive form fields use an underscore prefix to avoid echoing them
back after failed submissions.

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
- `pnpm test` — logging, environment validation, and remote form authorization tests
- `pnpm lint` — formatting checks
- `pnpm build` — production build
