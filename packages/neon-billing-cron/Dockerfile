# Stage 1: Build with Bun
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY tsconfig.json ./

# Copy shared package
COPY packages/shared ./packages/shared

# Copy neon-billing-cron package
COPY packages/neon-billing-cron ./packages/neon-billing-cron

# Install dependencies
RUN bun install

# Build shared package
WORKDIR /app/packages/shared
RUN bun run build

# Build neon-billing-cron
WORKDIR /app/packages/neon-billing-cron
RUN bun run build

# Stage 2: Production with Node.js
FROM node:20-slim AS production

WORKDIR /app

# Copy built files
COPY --from=builder /app/packages/neon-billing-cron/dist ./dist
COPY --from=builder /app/packages/neon-billing-cron/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./node_modules/@nowgai/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@nowgai/shared/

# Expose port
EXPOSE 3001

# Start the service
CMD ["node", "dist/index.js"]
