FROM node:20-bullseye

# Install system dependencies (Python, Go, curl, unzip, postgresql-client)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    golang-go \
    curl \
    unzip \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /app

# Copy lock files and package.json to cache layers
COPY package.json bun.lock* ./
COPY src/frontend/package.json ./src/frontend/
COPY src/frontend/bun.lock* ./src/frontend/

# Install dependencies
RUN bun install
RUN cd src/frontend && bun install

# Copy application source code
COPY . .

# Build the Next.js production bundle
RUN cd src/frontend && bun run build

# Make the docker entrypoint executable
RUN chmod +x scripts/docker-entrypoint.sh

# Expose all portal and app ports
EXPOSE 3001 3002 8085 8086 8087

ENTRYPOINT ["scripts/docker-entrypoint.sh"]
