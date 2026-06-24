FROM oven/bun:1.1

WORKDIR /app

# Copy dependency files
COPY package.json ./

# Install dependencies
RUN bun install --production

# Copy application source
COPY server.ts index.html ./

# Expose app port
EXPOSE 8095

# Command to run the app
CMD ["bun", "run", "server.ts"]
