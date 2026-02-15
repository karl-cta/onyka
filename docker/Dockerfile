# =============================================================================
# Onyka - Production Docker Image
# Multi-stage build with security hardening
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

WORKDIR /app

# Copy package files first (better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY apps/server ./apps/server
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
COPY tsconfig.json ./

# Build all packages
RUN pnpm build

# Prune to production dependencies (native bindings already compiled)
RUN npm pkg delete scripts.prepare && \
    CI=true pnpm install --prod --frozen-lockfile && \
    pnpm store prune

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Security: Don't run as root
RUN addgroup -g 1001 -S onyka && \
    adduser -S onyka -u 1001 -G onyka

# Install curl (healthcheck) and sqlite (backup)
RUN apk add --no-cache curl sqlite

WORKDIR /app

# Copy built files and production node_modules from builder
# App code is read-only, no need to chown everything
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/drizzle ./apps/server/drizzle
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules
COPY scripts/backup.js ./scripts/backup.js

# Only chown the writable data directory (DB + uploads + secrets all live here)
RUN mkdir -p /app/data && \
    chown onyka:onyka /app/data

# Security: Drop all capabilities, run as non-root
USER onyka

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/app/data/onyka.db

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Run migrations then start server
CMD ["sh", "-c", "node apps/server/dist/db/migrate.js && node apps/server/dist/index.js"]
