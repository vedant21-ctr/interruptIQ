FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @interrupt-iq/web build

FROM nginx:stable-alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
