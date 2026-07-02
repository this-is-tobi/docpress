ARG BUN_IMAGE=docker.io/oven/bun:1.3.14
ARG NODE_IMAGE=docker.io/node:24.14.0-slim

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
FROM ${NODE_IMAGE} AS prod

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
WORKDIR /app
RUN apt update && apt install -y git && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /home/node/logs && chmod 660 -R /home/node/logs \
  && mkdir -p /home/node/.npm && chmod 660 -R /home/node/.npm \
  && chown -R node:root /app \
  && git config --system --add safe.directory '*'
COPY --chown=node:root --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:root --from=build /app/dist ./dist
COPY --chown=node:root --from=build /app/types ./types
COPY --chown=node:root --from=build /app/bin ./bin
COPY --chown=node:root --from=build /app/package.json ./
USER node
ENTRYPOINT ["/app/bin/docpress.js"]
