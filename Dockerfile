ARG NODE_IMAGE=docker.io/node:22.18.0-slim

# Base stage
FROM ${NODE_IMAGE} AS base

ARG PNPM_VERSION=10.14.0
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable pnpm && corepack install -g pnpm@${PNPM_VERSION}
COPY --chown=node:root . ./


# Dev stage
FROM base AS dev

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
ENTRYPOINT [ "pnpm", "run" ]
CMD [ "dev" ]


# Prod dependencies stage
FROM base AS prod-deps

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile --ignore-scripts


# Build stage
FROM base AS build

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build


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
