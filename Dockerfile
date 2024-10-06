ARG NODE_IMAGE=docker.io/node:20.17.0-bullseye-slim

# Base stage
FROM ${NODE_IMAGE} AS base

ARG PNPM_VERSION=9.11.0
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN npm install --ignore-scripts --location=global pnpm@${PNPM_VERSION} && corepack enable
COPY --chown=node:root . ./
RUN pnpm install --frozen-lockfile
ENTRYPOINT [ "pnpm", "run" ]
CMD [ "dev" ]


# Dependencies stage
FROM base AS deps

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile


# Build stage
FROM base AS build

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build


# Prod stage
FROM ${NODE_IMAGE} AS prod

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
WORKDIR /app
RUN mkdir -p /home/node/logs && chmod 660 -R /home/node/logs \
  && mkdir -p /home/node/.npm && chmod 660 -R /home/node/.npm \
  && chown node:root /app
COPY --chown=node:root --from=deps /app/node_modules ./node_modules
COPY --chown=node:root --from=build /app/dist ./dist
COPY --chown=node:root --from=build /app/package.json ./
USER node
EXPOSE 8080
ENTRYPOINT ["node", "/app/dist/index.js"]
