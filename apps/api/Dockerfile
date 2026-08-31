# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./

COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/ui/package.json ./packages/ui/
COPY services/simulator/package.json ./services/simulator/
COPY services/telemetry-worker/package.json ./services/telemetry-worker/
COPY services/notification-worker/package.json ./services/notification-worker/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY packages/ ./packages/
COPY services/simulator/ ./services/simulator/
COPY apps/api/ ./apps/api/

RUN pnpm --filter @skynav/config --filter @skynav/contracts --filter @skynav/simulator --filter @skynav/api build

FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl wget
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 skynav

COPY --from=builder --chown=skynav:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=skynav:nodejs /app/packages ./packages
COPY --from=builder --chown=skynav:nodejs /app/services/simulator ./services/simulator
COPY --from=builder --chown=skynav:nodejs /app/apps/api ./apps/api
COPY --from=builder --chown=skynav:nodejs /app/package.json ./package.json

USER skynav

ENV NODE_ENV=production
ENV API_PORT=3001
ENV API_HOST=0.0.0.0

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1

CMD ["node", "apps/api/dist/server.js"]
