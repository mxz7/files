import { building } from "$app/env";
import { defineEnvVars } from "@sveltejs/kit/env";
import { z } from "zod";

// Service credentials are required at runtime, but not when building the Docker image.
const required = building ? z.string().default("") : z.string().min(1);

export const variables = defineEnvVars({
  S3_BUCKET: { schema: required },
  CRON_SECRET: { schema: required },
  S3_ENDPOINT: { schema: required },
  S3_KEY_ID: { schema: required },
  S3_ACCESS_KEY: { schema: required },
  DB_TOKEN: { schema: required },
  DB_URL: { schema: required },
  LOKI_HOST: { schema: (input) => input ?? "" },
  LOKI_USERNAME: { schema: (input) => input ?? "" },
  LOKI_PASSWORD: { schema: (input) => input ?? "" },
  LOKI_TENANT_ID: { schema: (input) => input ?? "" },
});
