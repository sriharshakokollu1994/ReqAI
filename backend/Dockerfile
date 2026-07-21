# ══════════════════════════════════════════════════════════════════════════════
# ReqAI – Backend Dockerfile
# Multi-stage: deps → builder → development | production
# ══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: dependency snapshot (production deps only) ──────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy manifests first to leverage Docker layer cache
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && \
    # Prune npm cache to shrink image layer
    npm cache clean --force


# ── Stage 2: full build ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src           ./src

RUN npm run build


# ── Stage 3: development (hot-reload via ts-node-dev) ────────────────────────
FROM node:20-alpine AS development
WORKDIR /app

# Required for health-check probe inside the container
RUN apk add --no-cache wget dumb-init

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src           ./src

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev"]


# ── Stage 4: production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# dumb-init: PID 1 signal forwarding + zombie reaping
# wget: health-check probe
RUN apk add --no-cache wget dumb-init && \
    # Non-root user for least-privilege execution
    addgroup -S appgroup && \
    adduser  -S appuser -G appgroup

# Copy production node_modules from deps stage (no devDependencies)
COPY --from=deps    --chown=appuser:appgroup /app/node_modules ./node_modules
# Copy compiled TypeScript output
COPY --from=builder --chown=appuser:appgroup /app/dist         ./dist
# Copy package.json for npm_package_version in health-check
COPY --chown=appuser:appgroup package.json ./

# Create writable log directory owned by appuser
RUN mkdir -p /app/logs && chown appuser:appgroup /app/logs

USER appuser
EXPOSE 3000

# Liveness probe: GET /api/v1/health/live
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health/live || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
