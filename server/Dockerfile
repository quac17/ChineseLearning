# Dockerfile dùng khi build deploy Backend lên GCP Cloud Run
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile || yarn install

COPY . .
RUN yarn build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db ./db
COPY --from=builder /app/tsconfig.json ./

RUN mkdir -p /app/uploads/videos /app/uploads/documents

EXPOSE 4000

# Tạo schema (nếu chưa có) rồi chạy server production
CMD ["sh", "-c", "yarn db:generate && yarn start:prod"]
