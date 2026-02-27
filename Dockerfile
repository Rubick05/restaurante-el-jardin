FROM node:20-alpine as builder

# Build Frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Cache bust: 2026-02-27-v2
RUN npm run build

# Build Backend
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npm run build

# Runtime Stage
FROM node:20-alpine
WORKDIR /app

# Copy Backend
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/src ./server/src

# Copy Frontend Build
COPY --from=builder /app/dist ./dist

# Install Production Deps for Server
WORKDIR /app/server
RUN npm ci --only=production

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
