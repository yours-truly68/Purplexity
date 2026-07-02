# ==========================================
# STAGE 1: Build the React Frontend
# ==========================================
FROM oven/bun:1.1-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend config and install dependencies
COPY frontend/package.json frontend/bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy frontend source files and compile static assets
COPY frontend/ ./
RUN bun run build

# ==========================================
# STAGE 2: Set up the Backend Server
# ==========================================
FROM oven/bun:1.1-alpine AS production
WORKDIR /app/backend

# Copy backend config and install dependencies
COPY backend/package.json backend/bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy backend source code
COPY backend/ ./

# Generate your specific Prisma client engine for the Alpine container environment
RUN bunx prisma generate

# Copy the compiled static frontend files from Stage 1 into the backend's dist folder
COPY --from=frontend-builder /app/backend/dist /app/dist

# Expose your combined application port
EXPOSE 3001
ENV PORT=3001

# Run the unified production server
CMD ["bun", "index.ts"]