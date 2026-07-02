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
RUN bun install --frozen-lockfile --ignore-scripts

COPY backend/ ./

# 🔥 FIX 2: Provide a placeholder database URL so Prisma can generate types without crashing during the build
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN bunx prisma generate

# 🔥 FIX 1: Corrected the folder path from /app/backend/dist to /app/frontend/dist
COPY --from=frontend-builder /app/frontend/dist /app/dist

EXPOSE 3001
ENV PORT=3001

CMD ["bun", "index.ts"]