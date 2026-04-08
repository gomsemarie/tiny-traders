# ── Build Stage ──
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY server/package.json server/
COPY client/package.json client/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY server/ server/
COPY client/ client/

# Build server
RUN pnpm --filter server build

# Build client
RUN pnpm --filter client build

# ── Production Stage ──
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY server/package.json server/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --filter server

# Copy built server
COPY --from=builder /app/server/dist server/dist/

# Copy built client (serve as static files)
COPY --from=builder /app/client/dist client/dist/

# SQLite data directory (volume mount point)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/app/data/tiny-traders.db

EXPOSE 4000

CMD ["node", "server/dist/index.js"]
