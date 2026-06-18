# ==========================================
# STAGE 1: Go Builder (Compile Go app to binary)
# ==========================================
FROM golang:1.21-bookworm AS go-builder
WORKDIR /build
COPY sandbox/apps/reference-go ./reference-go
WORKDIR /build/reference-go
RUN go build -ldflags="-s -w" -o /build/reference-go-bin main.go

# ==========================================
# STAGE 2: Node/Bun JS/TS Builder (Install and Compile frontend/backend)
# ==========================================
FROM oven/bun:1.2 AS bun-src

FROM node:20-bookworm-slim AS js-builder
COPY --from=bun-src /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

# Copy lockfiles and manifests to leverage caching
COPY package.json bun.lock ./
COPY core/package.json ./core/
COPY packages/sdk/package.json ./packages/sdk/
COPY sandbox/apps/reference-expenses/package.json ./sandbox/apps/reference-expenses/
COPY core/src/frontend/package.json ./core/src/frontend/

# Install dependencies using Bun
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
# Install frontend packages (not in workspace root)
RUN cd core/src/frontend && bun install --frozen-lockfile

# Copy remaining source code
COPY . .

# Build Next.js production bundle
RUN cd core/src/frontend && bun run build

# ==========================================
# STAGE 3: Final Production Runner (Minimal and Secure)
# ==========================================
FROM node:20-bookworm-slim AS runner

COPY --from=bun-src /usr/local/bin/bun /usr/local/bin/bun

# Install Python (minimal runtimes), postgresql-client, and Docker CE CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-minimal \
    postgresql-client \
    ca-certificates \
    curl \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && apt-get purge -y curl gnupg \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built code and production files from js-builder
COPY --from=js-builder /app/package.json /app/bun.lock /app/tsconfig.json ./
COPY --from=js-builder /app/node_modules ./node_modules
COPY --from=js-builder /app/core ./core
COPY --from=js-builder /app/packages ./packages
COPY --from=js-builder /app/sandbox ./sandbox
COPY --from=js-builder /app/scripts ./scripts
COPY --from=js-builder /app/test ./test

# Copy the compiled Go binary from go-builder
COPY --from=go-builder /build/reference-go-bin /app/sandbox/apps/reference-go/reference-go-bin

# Expose ports
EXPOSE 3001 3002 3003 8085 8086 8087

# Copy and set production entrypoint
COPY docker/production/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
