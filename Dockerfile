ARG BUN_IMAGE=docker.io/oven/bun:1.4.5@sha256:3aa040e5445efa09d75bb428a64ba50db13e2b3ac9b6b0c7f145615f62b2ee18
ARG BUN_ALPINE_IMAGE=docker.io/oven/bun:1.4.5-alpine@sha256:da816670775f4c2b4e990b6b1847cf5540dcdc721a42033dd331ce7a88ba6a3b

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


# Prod dependencies stage - installed on the prod image's libc (musl), because bun only
# fetches the native optional packages (rollup, lightningcss, ...) matching the host libc
FROM ${BUN_ALPINE_IMAGE} AS prod-deps

WORKDIR /app
COPY package.json bun.lock ./
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
