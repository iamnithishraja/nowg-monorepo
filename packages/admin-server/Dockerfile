# Stage 1: Build
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json bun.lock ./
COPY tsconfig.json ./

# Copy shared package
COPY packages/shared ./packages/shared

# Copy admin-server package
COPY packages/admin-server ./packages/admin-server

# Install dependencies
RUN bun install

# Build shared package first
WORKDIR /app/packages/shared
RUN bun run build

# Stage 2: Production
FROM oven/bun:1-slim AS production

WORKDIR /app

# Copy source files (start script runs index.ts directly)
COPY --from=builder /app/packages/admin-server ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./node_modules/@nowgai/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@nowgai/shared/

# Default port 3000 (from code: PORT || 3000)
EXPOSE 3000

# Same as package.json "start" script: bun run index.ts
CMD ["bun", "run", "index.ts"]
