FROM oven/bun:1

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --production --ignore-scripts

# Copy application source (including test folder for seed data imports)
COPY db ./db
COPY backend ./backend
COPY frontend ./frontend
COPY test ./test

# Expose app port
EXPOSE 8095

# Command to run the app
CMD ["bun", "run", "backend/server.ts"]
