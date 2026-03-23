# ── Stage 1: install all workspace dependencies ───────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable

WORKDIR /repo

# Copy manifests first for better layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json        apps/frontend/package.json
COPY packages/domain/package.json      packages/domain/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 2: build domain + frontend ─────────────────────────────────────────
FROM deps AS builder

COPY packages/domain/  packages/domain/
COPY apps/frontend/    apps/frontend/
COPY tsconfig.base.json ./
COPY turbo.json        ./

# Build shared domain types, then the frontend.
RUN pnpm --filter @interference/domain build
RUN pnpm --filter @interference/frontend build

# ── Stage 3: serve with nginx ────────────────────────────────────────────────
FROM nginx:alpine AS runtime

# Remove default nginx config.
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config and built static files.
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
