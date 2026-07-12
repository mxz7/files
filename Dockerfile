# syntax = docker/dockerfile:1

FROM node:24-slim as base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI="true"

# SvelteKit/Prisma app lives here
WORKDIR /app

# install pnpm
RUN corepack enable pnpm && corepack install -g pnpm@11

# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules
RUN apt update -qq && \
    apt install --no-install-recommends -y build-essential node-gyp openssl pkg-config python-is-python3

# dependencies
COPY --link .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
RUN pnpm install -r --offline

# Copy source
COPY --link . .

# Builds sveltekit tsconfig which prisma needs
RUN npx svelte-kit sync

RUN pnpm run build
RUN pnpm prune --prod

# Final stage for app image
FROM base

# # # Install packages needed for deployment
RUN apt update -qq && \
    apt install --no-install-recommends -y openssl curl exiftool && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Copy built application
COPY --from=build /app/build /app/build
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/start-docker.sh /app/start-docker.sh
COPY --from=build /app/drizzle.config.ts /app/drizzle.config.ts

# Set production environment
ENV NODE_ENV="production"
ENV ADDRESS_HEADER="cf-connecting-ip"
ENV BODY_SIZE_LIMIT="1G"

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000

RUN chmod +x ./start-docker.sh

ENTRYPOINT ["./start-docker.sh"]