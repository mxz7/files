import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { createLogger } from "vite";
import { defineConfig } from "vitest/config";
import { stripVTControlCharacters } from "node:util";

const logger = createLogger();
for (const level of ["info", "error"] as const) {
  const log = logger[level].bind(logger);
  logger[level] = (message, options) => {
    // Request and error logs are handled by the app's structured logger.
    if (/^\d{3} [A-Z]+ \//.test(stripVTControlCharacters(message))) return;
    log(message, options);
  };
}

export default defineConfig(({ mode }) => ({
  customLogger: logger,
  plugins: [
    sveltekit({
      // Consult https://kit.svelte.dev/docs/integrations#preprocessors
      // for more information about preprocessors
      preprocess: [vitePreprocess({})],

      // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
      // If your environment is not supported or you settled on a specific environment, switch out the adapter.
      // See https://kit.svelte.dev/docs/adapters for more information about adapters.
      adapter: adapter(),
      // adapter-node 6 no longer reads ORIGIN. Dev derives its origin from the request.
      paths: { origin: mode === "production" ? "https://files.maxz.dev" : undefined },
    }),
    tailwindcss(),
  ],
  test: { include: ["tests/**/*.test.ts"] },
}));
