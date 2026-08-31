# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
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

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @skynav/web build

FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl wget
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/packages ./packages
COPY --from=builder --chown=nextjs:nodejs /app/apps/web ./apps/web
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=nextjs:nodejs /app/turbo.json ./turbo.json

USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000 || exit 1

CMD ["pnpm", "--filter", "@skynav/web", "start"]
