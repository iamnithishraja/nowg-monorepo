# Stage 1: Build
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock ./
COPY tsconfig.json ./

# Copy shared package
COPY packages/shared ./packages/shared

# Copy datadock-api package
COPY packages/datadock-api ./packages/datadock-api

# Install dependencies
RUN bun install

# Build shared package first
WORKDIR /app/packages/shared
RUN bun run build

# Build datadock-api
WORKDIR /app/packages/datadock-api
RUN bun run build

# Stage 2: Production
FROM oven/bun:1-slim AS production

WORKDIR /app

# Copy built files and node_modules
COPY --from=builder /app/packages/datadock-api/dist ./dist
COPY --from=builder /app/packages/datadock-api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./node_modules/@nowgai/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@nowgai/shared/

# Port 3001 for docker (to avoid conflict with admin-server)
EXPOSE 3001

# Same as package.json "start" script: bun run dist/index.js
CMD ["bun", "run", "dist/index.js"]
