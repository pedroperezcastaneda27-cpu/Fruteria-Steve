# Multi-stage Dockerfile optimized for Render and Prisma

# 1) Builder stage: install all dependencies (including dev), generate Prisma client, then build frontend
FROM node:18-bullseye AS builder
WORKDIR /app

# Copy package manifests first to leverage layer cache
COPY package.json package-lock.json* ./

# Install all dependencies (dev + prod) so Prisma CLI and build tools are available
RUN npm ci --silent --no-audit --progress=false

# Copy Prisma schema and source files needed for build
COPY prisma ./prisma
COPY tsconfig.json tsconfig.node.json vite.config.ts ./
COPY public ./public
COPY src ./src
COPY server ./server

# Generate Prisma client BEFORE the build (ensures @prisma/client is ready)
RUN npx prisma generate

# Build the frontend (Vite) and produce /dist
RUN npm run build

# 2) Runtime stage: copy only what's needed for runtime
FROM node:18-bullseye-slim AS runtime
WORKDIR /app

# Copy built frontend and node_modules (containing @prisma/client)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server ./server

ENV NODE_ENV=production
EXPOSE 4000

# Healthcheck optional
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD [ "node", "server/healthcheck.js" ] || exit 0

# Entrypoint: ensure Prisma client generated, run migrations, seed (if DB configured) and start server
# The commands are guarded: migrate/seed run only if DATABASE_URL is set
CMD ["sh", "-c", "npx prisma generate && if [ -n \"$DATABASE_URL\" ]; then npx prisma migrate deploy && node prisma/seed.js; fi && node server/index.js"]
