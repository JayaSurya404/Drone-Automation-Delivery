# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY services/simulator/ ./services/simulator/
COPY services/telemetry-worker/ ./services/telemetry-worker/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @skynav/telemetry-worker build

FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 skynav

COPY --from=builder --chown=skynav:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=skynav:nodejs /app/packages ./packages
COPY --from=builder --chown=skynav:nodejs /app/services/simulator ./services/simulator
COPY --from=builder --chown=skynav:nodejs /app/services/telemetry-worker ./services/telemetry-worker
COPY --from=builder --chown=skynav:nodejs /app/package.json ./package.json
COPY --from=builder --chown=skynav:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=skynav:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=skynav:nodejs /app/turbo.json ./turbo.json

USER skynav

ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@skynav/telemetry-worker", "start"]
