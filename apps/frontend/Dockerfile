# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable

WORKDIR /repo

# Copy manifests first for better layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json  apps/frontend/package.json
COPY packages/domain/package.json packages/domain/package.json

RUN pnpm install --frozen-lockfile

COPY packages/domain/ packages/domain/
COPY apps/frontend/   apps/frontend/
COPY turbo.json       ./

RUN pnpm --filter @interference/domain build
RUN pnpm --filter @interference/frontend build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80
