FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY dashboard-api/package*.json ./

# Install dependencies
RUN npm install

# Copy server files
COPY dashboard-api/ ./
COPY shared/ ./shared/

# Create logs directory
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["npm", "start"]