FROM golang:1.21-bookworm AS go-src
FROM oven/bun:1.2 AS bun-src

FROM node:20-bookworm-slim

# Copy Go compiler and Bun runtime
COPY --from=go-src /usr/local/go /usr/local/go
COPY --from=bun-src /usr/local/bin/bun /usr/local/bin/bun

ENV PATH="/usr/local/go/bin:${PATH}"

# Install minimal system dependencies (Python, postgresql-client, ca-certificates)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    postgresql-client \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Expose all portal and app ports
EXPOSE 3001 3002 3003 8085 8086 8087

# Copy and set entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
