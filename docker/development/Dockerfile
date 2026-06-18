FROM golang:1.21-bookworm AS go-src
FROM oven/bun:1.2 AS bun-src

FROM node:20-bookworm-slim

# Copy Go compiler and Bun runtime
COPY --from=go-src /usr/local/go /usr/local/go
COPY --from=bun-src /usr/local/bin/bun /usr/local/bin/bun

ENV PATH="/usr/local/go/bin:${PATH}"

# Install minimal system dependencies (Python, postgresql-client, ca-certificates) and Docker CE CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
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

# Expose all portal and app ports
EXPOSE 3001 3002 3003 8085 8086 8087

# Copy and set entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
