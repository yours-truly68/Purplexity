# ==========================================
# STAGE 1: Build the React Frontend
# ==========================================
FROM oven/bun:1.1-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lockb* ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build

# ==========================================
# STAGE 2: Set up the Backend Server
# ==========================================
FROM oven/bun:1.1-alpine AS production
WORKDIR /app/backend

COPY backend/package.json backend/bun.lockb* ./

# 🔥 FIX: Added --ignore-scripts to bypass the Prisma pre-install version block
RUN bun install --frozen-lockfile --ignore-scripts

COPY backend/ ./

# Generate your specific Prisma client engine for the Alpine container environment
RUN bunx prisma generate

COPY --from=frontend-builder /app/backend/dist /app/dist

EXPOSE 3001
ENV PORT=3001

CMD ["bun", "index.ts"]