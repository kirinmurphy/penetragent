FROM node:20-slim AS builder

# Install curl for healthchecks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy ONLY package files first (better caching - invalidates only when deps change)
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY scanner/package.json scanner/
COPY controller/package.json controller/

# Install dependencies (this layer is cached unless package*.json changes)
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy source AFTER installing deps (source changes don't invalidate npm ci)
COPY shared/ shared/
COPY scanner/ scanner/

# Build shared first, then scanner
RUN npm run build -w shared && npm run build -w scanner

# --- Production stage ---
FROM node:20-slim

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY scanner/package.json scanner/
COPY controller/package.json controller/

RUN npm ci --omit=dev

COPY --from=builder /app/shared/dist shared/dist
COPY --from=builder /app/scanner/dist scanner/dist

WORKDIR /app/scanner

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "dist/index.js"]
