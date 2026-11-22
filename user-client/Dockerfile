# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile || yarn install

# Stage 2: Build Next.js standalone app
FROM node:20-alpine AS builder
WORKDIR /app
# NEXT_PUBLIC_* are inlined at build time: changing one means rebuilding the image.
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

# Stage 3: Minimal production runner (ideal for Docker & GCP Cloud Run)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# standalone output does not include public/ (logo, PWA icons, stock photos).
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
