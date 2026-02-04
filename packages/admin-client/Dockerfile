# Stage 1: Build
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock ./
COPY tsconfig.json ./

# Copy shared package
COPY packages/shared ./packages/shared

# Copy admin-client package
COPY packages/admin-client ./packages/admin-client

# Install dependencies
RUN bun install

# Build shared package first
WORKDIR /app/packages/shared
RUN bun run build

# Build admin-client
WORKDIR /app/packages/admin-client
RUN bun run build

# Stage 2: Production
FROM oven/bun:1-slim AS production

WORKDIR /app

# Copy built static files
COPY --from=builder /app/packages/admin-client/dist ./dist

# Port 5174 matches vite.config.ts
EXPOSE 5174

CMD ["bunx", "--bun", "serve", "-s", "dist", "-l", "5174"]
