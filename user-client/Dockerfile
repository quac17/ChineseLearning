# Learner web app image for Cloud Run (Next.js standalone output).
# Build: docker build --build-arg NEXT_PUBLIC_API_URL=https://api.example.vn/api -t chinese-learner-client ./user-client

# 1. Dependencies (cached until package.json / yarn.lock change).
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive

# 2. Build. NEXT_PUBLIC_* are inlined now: changing one means rebuilding the image.
FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ARG NEXT_PUBLIC_SUPPORT_CONTACT=
ARG NEXT_PUBLIC_REFUND_POLICY=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SUPPORT_CONTACT=${NEXT_PUBLIC_SUPPORT_CONTACT}
ENV NEXT_PUBLIC_REFUND_POLICY=${NEXT_PUBLIC_REFUND_POLICY}
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

# 3. Runtime: only the standalone server, static assets and public/, as the `node` user.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run sets PORT (8080 unless --port is given); the standalone server.js reads it.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# standalone output does not include public/ (logo, PWA icons, stock photos).
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 8080
CMD ["node", "server.js"]
