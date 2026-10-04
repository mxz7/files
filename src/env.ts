import { defineEnvVars } from "@sveltejs/kit/env";

// @migration-task Review usage of dynamic environment variables. They fall back to the empty string if not present, which may not be what you want.
export const variables = defineEnvVars({
  S3_BUCKET: { schema: (input) => input ?? "" },
  CRON_SECRET: { schema: (input) => input ?? "" },
  S3_ENDPOINT: { schema: (input) => input ?? "" },
  S3_KEY_ID: { schema: (input) => input ?? "" },
  S3_ACCESS_KEY: { schema: (input) => input ?? "" },
  DB_TOKEN: { schema: (input) => input ?? "" },
  DB_URL: { schema: (input) => input ?? "" },
});
