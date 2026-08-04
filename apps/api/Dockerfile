FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@9
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @interrupt-iq/embedding-engine build
RUN pnpm --filter @interrupt-iq/api build

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm@9
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm install --prod --no-frozen-lockfile
COPY --from=builder /app/packages/embedding-engine/dist ./packages/embedding-engine/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001

CMD ["pnpm", "--filter", "@interrupt-iq/api", "start"]
