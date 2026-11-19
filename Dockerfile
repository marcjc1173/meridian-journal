# Stage 1: Build React client
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build Express/TypeScript server
FROM node:22-slim AS server-build
WORKDIR /app/server
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Lean production image
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

COPY --from=server-build /app/server/package*.json ./server/
COPY --from=server-build /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/dist ./server/dist
COPY --from=client-build /app/client/dist ./client/dist

RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3001

WORKDIR /app/server
CMD ["node", "dist/index.js"]
