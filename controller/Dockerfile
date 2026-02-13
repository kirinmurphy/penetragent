FROM node:20-slim AS builder

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
COPY controller/ controller/

# Build shared first, then controller
RUN npm run build -w shared && npm run build -w controller

# --- Production stage ---
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY scanner/package.json scanner/
COPY controller/package.json controller/

RUN npm ci --omit=dev

COPY --from=builder /app/shared/dist shared/dist
COPY --from=builder /app/controller/dist controller/dist

WORKDIR /app/controller

CMD ["node", "dist/index.js"]
