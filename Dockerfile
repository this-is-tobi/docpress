ARG BUN_IMAGE=docker.io/oven/bun:1.3.14
ARG BUN_ALPINE_IMAGE=docker.io/oven/bun:1.3.14-alpine

# Base stage
FROM ${BUN_IMAGE} AS base

WORKDIR /app
COPY . ./


# Dev stage
FROM base AS dev

RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --frozen-lockfile
ENTRYPOINT [ "bun", "run" ]
CMD [ "dev" ]


# Prod dependencies stage
FROM base AS prod-deps

RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --production --frozen-lockfile --ignore-scripts


# Build stage
FROM base AS build

RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache bun install --frozen-lockfile
RUN bun run build


# Prod stage
FROM ${BUN_ALPINE_IMAGE} AS prod

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
WORKDIR /app
RUN apk add --no-cache git \
  && chown -R bun:root /app \
  && git config --system --add safe.directory '*'
COPY --chown=bun:root --from=prod-deps /app/node_modules ./node_modules
COPY --chown=bun:root --from=build /app/dist ./dist
COPY --chown=bun:root --from=build /app/bin ./bin
COPY --chown=bun:root --from=build /app/package.json ./
USER bun
ENTRYPOINT ["bun", "/app/bin/docpress.js"]
