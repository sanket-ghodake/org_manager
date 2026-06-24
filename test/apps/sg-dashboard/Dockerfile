FROM oven/bun:1.1

WORKDIR /app

# Copy dependency files
COPY package.json ./

# Install dependencies
RUN bun install --production

# Copy application source
COPY db ./db
COPY backend ./backend
COPY frontend ./frontend

# Expose app port
EXPOSE 8095

# Command to run the app
CMD ["bun", "run", "backend/server.ts"]
