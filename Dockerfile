# Multi-stage build for smaller image size
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

# Set working directory
WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY --chown=botuser:nodejs src/ ./src/
COPY --chown=botuser:nodejs package*.json ./

# Create logs directory
RUN mkdir -p logs && chown botuser:nodejs logs

# Switch to non-root user
USER botuser

# Expose port for health checks
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV LOG_FORMAT=json

# Labels for metadata
LABEL maintainer="mike@darlington.dev"
LABEL version="1.0.0"
LABEL description="TwitterMentions - Real-time Twitter mention detection bot"

# Start the application
CMD ["node", "src/app.js"]