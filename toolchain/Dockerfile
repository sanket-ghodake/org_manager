# Base image with essential build tools
FROM debian:bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    make \
    xz-utils \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Go 1.21
RUN curl -sSL https://go.dev/dl/go1.21.6.linux-amd64.tar.gz | tar -xz -C /usr/local
ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/go"
ENV PATH="${GOPATH}/bin:${PATH}"

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
ENV BUN_INSTALL="/root/.bun"
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Install Python-based tools (Ruff, SQLFluff, Semgrep, MkDocs, and Material theme)
# We use --break-system-packages in Debian Bookworm since it's a dedicated container
RUN pip install --no-cache-dir --break-system-packages \
    ruff==0.1.11 \
    sqlfluff>=3.0.0 \
    semgrep==1.54.0 \
    mkdocs==1.5.3 \
    mkdocs-material==9.5.3


# Install golangci-lint
RUN curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b /usr/local/bin v1.54.2

# Install govulncheck
RUN go install golang.org/x/vuln/cmd/govulncheck@latest

# Install Gitleaks (Secret detection)
RUN curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v8.18.2/gitleaks_8.18.2_linux_x64.tar.gz | tar -xz -C /usr/local/bin gitleaks

# Copy Trivy from the official image
COPY --from=aquasec/trivy:0.49.1 /usr/local/bin/trivy /usr/local/bin/trivy

# Install dependency-cruiser globally
RUN npm install -g dependency-cruiser@16.2.0

# Set workspace directory
WORKDIR /app

# Set default entrypoint to shell wrapper
COPY run-checks.sh /usr/local/bin/run-checks
RUN chmod +x /usr/local/bin/run-checks

ENTRYPOINT ["run-checks"]
CMD ["all"]
