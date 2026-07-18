# syntax = docker/dockerfile:1

FROM node:24-slim AS base

WORKDIR /app

FROM base AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI="true"

# install pnpm
RUN corepack enable pnpm

# dependencies
COPY --link .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch && pnpm install --offline --frozen-lockfile

# Copy source
COPY --link . .

# Builds sveltekit tsconfig which prisma needs
RUN pnpm exec svelte-kit sync

RUN pnpm run build
RUN pnpm prune --prod

# Final stage for app image
FROM base

# # # Install packages needed for deployment
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y exiftool && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Copy built application
COPY --chown=node:node --from=build /app/build /app/build
COPY --chown=node:node --from=build /app/node_modules /app/node_modules
COPY --chown=node:node --from=build /app/package.json /app/package.json
COPY --chmod=755 --chown=node:node --from=build /app/start-docker.sh /app/start-docker.sh
COPY --chown=node:node --from=build /app/drizzle.config.ts /app/drizzle.config.ts
COPY --chown=node:node --from=build /app/drizzle /app/drizzle

# Set production environment
ENV NODE_ENV="production"
ENV ADDRESS_HEADER="cf-connecting-ip"
ENV BODY_SIZE_LIMIT="1G"

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "const p=process.env.PORT||3000;fetch('http://127.0.0.1:'+p+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000

USER node

ENTRYPOINT ["./start-docker.sh"]
