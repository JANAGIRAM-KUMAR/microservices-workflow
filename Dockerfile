# syntax=docker/dockerfile:1

# The services run TypeScript sources directly via `tsx` (no compile step in this
# repo), and `packages/shared` is consumed as raw source through its package.json
# "main"/"exports". So the runtime image must keep both node_modules (dev deps
# included, because `tsx` IS the runtime) and the .ts sources.

# ---------- deps: install workspace deps once, cached on package.json changes ----------
FROM node:22-bookworm-slim AS deps

WORKDIR /app

# Only manifests first so `npm ci` is re-run only when dependencies change.
COPY package.json package-lock.json ./
COPY apps/api-gateway/package.json      apps/api-gateway/
COPY apps/auth-service/package.json     apps/auth-service/
COPY apps/task-service/package.json     apps/task-service/
COPY apps/media-service/package.json    apps/media-service/
COPY apps/workflow-service/package.json apps/workflow-service/
COPY packages/shared/package.json       packages/shared/

# --include=dev is REQUIRED: `tsx` lives in devDependencies but is the entrypoint.
# Do NOT switch to --omit=dev without adding tsx to dependencies and changing
# the start scripts first, or every container dies with "tsx: not found".
RUN npm ci --include=dev && npm cache clean --force


# ---------- runtime: the image all five services share ----------
FROM node:22-bookworm-slim AS runtime

# tini reaps zombies and forwards SIGTERM so `docker stop` shuts down cleanly
# instead of waiting out the 10s kill timeout.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json tsconfig.base.json ./
COPY --chown=node:node apps ./apps
COPY --chown=node:node packages ./packages
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node sql ./sql

USER node

EXPOSE 5009 5010 5011 5012 5013

# Default to the gateway; compose overrides `command` per service.
# Using `npm run start -w <pkg>` (rather than calling tsx directly) sets the
# working directory to the workspace, which is what the services' relative
# dotenv paths (`./.env` then `../../.env`) expect.
CMD ["npm", "run", "start", "-w", "api-gateway"]

ENTRYPOINT ["/usr/bin/tini", "--"]
