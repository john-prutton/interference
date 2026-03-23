# ── Stage 1: install all workspace dependencies ───────────────────────────────
FROM node:22-alpine AS deps

# Enable corepack so the image has the right pnpm version.
RUN corepack enable

WORKDIR /repo

# Copy manifests first for better layer caching.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json           apps/backend/package.json
COPY packages/domain/package.json        packages/domain/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 2: build domain + backend ───────────────────────────────────────────
FROM deps AS builder

COPY packages/domain/ packages/domain/
COPY apps/backend/    apps/backend/
COPY turbo.json       ./

# Build shared domain types, then the backend.
RUN pnpm --filter @interference/domain build
RUN pnpm --filter @interference/backend build

# Create a standalone deployment bundle (production deps only, no workspaces).
RUN pnpm deploy --filter @interference/backend --prod /deploy

# ── Stage 3: minimal runtime image ────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Copy the self-contained deployment bundle produced by pnpm deploy.
COPY --from=builder /deploy/node_modules ./node_modules
COPY --from=builder /deploy/dist         ./dist

# Default env — override at runtime with -e or --env-file.
ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production

EXPOSE ${PORT}

CMD ["node", "dist/index.js"]
