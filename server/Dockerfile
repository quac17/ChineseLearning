# Backend image for Cloud Run (also runs with plain `docker run`).
# Build: docker build -t vankinh-server ./server
#
# The schema is NOT created at start-up: load 01_schema.sql / 02_master_data.sql
# once and run server/db/migrations/*.sql by hand (tmp/HUONG-DAN-DEPLOY-GCP.md).
# The image therefore needs no ts-node or other devDependencies.

# 1. Build with all dependencies.
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN yarn build

# 2. Production dependencies only.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production --non-interactive && yarn cache clean

# 3. Runtime: compiled code + production node_modules, as the unprivileged `node` user.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Cloud Run sets PORT (8080 unless --port is given); main.ts listens on it.
ENV PORT=8080
# Scratch folder for multipart uploads before they move to the bucket.
# /tmp is writable on Cloud Run (in memory); point it at a mounted volume if you use STORAGE_BACKEND=local.
ENV UPLOAD_DIR=/tmp/vankinh-uploads

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node
EXPOSE 8080
CMD ["node", "dist/main"]
