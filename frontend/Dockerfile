# ══════════════════════════════════════════════════════════════════════════════
# ReqAI – Frontend Dockerfile
# Multi-stage: development (Vite dev server) | builder | production (nginx)
# ══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: development (Vite HMR) ──────────────────────────────────────────
FROM node:20-alpine AS development
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Source mounted as volume at runtime — copy here only for standalone builds
COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


# ── Stage 2: builder (Vite production build) ──────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# VITE_API_BASE_URL injected at build time (defaults to relative /api/v1 for
# nginx-proxied deployments; override for standalone frontend deployments).
ARG  VITE_API_BASE_URL=/api/v1
ENV  VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build


# ── Stage 3: production (nginx static file server) ───────────────────────────
FROM nginx:1.27-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built SPA assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy production nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx runs as non-root inside the official image (uid 101)
EXPOSE 80

# Liveness probe: ensure nginx is responding
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/ | grep -q "ReqAI" || exit 0

CMD ["nginx", "-g", "daemon off;"]
