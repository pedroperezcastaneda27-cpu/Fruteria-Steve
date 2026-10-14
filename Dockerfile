# Build stage
FROM node:18-bullseye as builder
WORKDIR /app

# Copy package files and install all dependencies (dev + prod) so we have prisma CLI available
COPY package.json package-lock.json* ./
# Copy project files needed for build
COPY prisma ./prisma
COPY tsconfig.json tsconfig.node.json vite.config.ts ./
COPY public ./public
COPY src ./src

RUN npm ci

# Generate Prisma client (requires node_modules/prisma)
RUN npx prisma generate || true

# Build frontend
RUN npm run build

# Runtime stage
FROM node:18-bullseye-slim
WORKDIR /app

# Copy built frontend and node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server ./server

ENV NODE_ENV=production
EXPOSE 4000

# Ensure migrations and seed run on container start (DATABASE_URL must be set in env)
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && node prisma/seed.js && node server/index.js"]
