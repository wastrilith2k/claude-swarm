FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    bash \
    git \
    docker-cli \
    wget \
    curl

# Copy package files
COPY agent-team/package*.json ./

# Install Node.js dependencies
RUN npm install --omit=dev

# Copy source code
COPY agent-team/src/ ./src/
RUN mkdir -p ./logs

# Create workspace directory
RUN mkdir -p ./workspace

# Set environment variables
ENV NODE_ENV=production
ENV WORKSPACE_PATH=/app/workspace

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start the swarm manager
CMD ["node", "src/swarm-manager.js"]
