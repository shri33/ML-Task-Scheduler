# =============================================================================
# Multi-stage Production Dockerfile for Backend API
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install OpenSSL for Prisma compatibility
RUN apk add --no-cache openssl libc6-compat

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Generate Prisma Client
RUN npx prisma generate

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --production

# -----------------------------------------------------------------------------
# Stage 3: Production Runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache openssl dumb-init

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nodejs

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Copy generated Prisma client from deps
COPY --from=deps --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start server
CMD ["node", "dist/index.js"]
