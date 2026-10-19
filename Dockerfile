ARG BUN_IMAGE=docker.io/oven/bun:1.4.3@sha256:ec06c3b6cea04192ae6770c434f668ca41d343ad19fa6472216c7b48be39c598
ARG BUN_ALPINE_IMAGE=docker.io/oven/bun:1.4.3-alpine@sha256:629e17411f1f129dbec3af78d5af9c9f2a937435c80349437206c6b0b7422373

# Base stage - only the dependency manifests so the install layers stay cached
# until package.json / bun.lock actually change
FROM ${BUN_IMAGE} AS base

WORKDIR /app
COPY package.json bun.lock ./


# Dev stage
FROM base AS dev

RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY . ./
ENTRYPOINT [ "bun", "run" ]
CMD [ "dev" ]


# Prod dependencies stage
FROM base AS prod-deps

RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --production --frozen-lockfile --ignore-scripts


# Build stage
FROM base AS build

RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY . ./
RUN bun run build


# Prod stage
FROM ${BUN_ALPINE_IMAGE} AS prod

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
WORKDIR /app
# Scope Git's ownership exception to the app tree instead of the whole filesystem;
# repositories are cloned into subdirectories of /app/docpress at runtime
RUN apk add --no-cache git \
  && chown -R bun:root /app \
  && git config --system --add safe.directory /app \
  && git config --system --add safe.directory '/app/docpress/*'
COPY --chown=bun:root --from=prod-deps /app/node_modules ./node_modules
COPY --chown=bun:root --from=build /app/dist ./dist
COPY --chown=bun:root --from=build /app/bin ./bin
COPY --chown=bun:root --from=build /app/package.json ./
USER bun
ENTRYPOINT ["bun", "/app/bin/docpress.js"]
