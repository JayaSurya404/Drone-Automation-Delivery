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
COPY apps/web/ ./apps/web/

ARG NEXT_PUBLIC_MAP_PROVIDER=osm
ARG NEXT_PUBLIC_MAP_STYLE_URL=""
ARG NEXT_PUBLIC_MAP_TILES_URL="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
ARG NEXT_PUBLIC_MAX_TRAIL_POINTS=25
ARG NEXT_PUBLIC_WS_URL="ws://localhost:3001/api/v1/ws/telemetry"

ENV NEXT_PUBLIC_MAP_PROVIDER=$NEXT_PUBLIC_MAP_PROVIDER
ENV NEXT_PUBLIC_MAP_STYLE_URL=$NEXT_PUBLIC_MAP_STYLE_URL
ENV NEXT_PUBLIC_MAP_TILES_URL=$NEXT_PUBLIC_MAP_TILES_URL
ENV NEXT_PUBLIC_MAX_TRAIL_POINTS=$NEXT_PUBLIC_MAX_TRAIL_POINTS
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

RUN pnpm --filter @skynav/contracts --filter @skynav/ui --filter @skynav/web build

FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl wget
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/packages ./packages
COPY --from=builder --chown=nextjs:nodejs /app/apps/web ./apps/web
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000 || exit 1

WORKDIR /app/apps/web
CMD ["node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
