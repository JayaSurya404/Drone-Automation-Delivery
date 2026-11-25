# SkyNav API — production image. Build from the REPO ROOT (needs the whole
# pnpm workspace to resolve internal packages), e.g.:
#   docker build -f apps/api/Dockerfile -t skynav-api .
#
# Debian slim (not Alpine) — Prisma's query engine has known musl-libc
# compatibility issues on Alpine; Debian avoids that class of problem
# entirely rather than working around it with extra binary targets.
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

FROM base AS build
# Every workspace member's package.json first (cheap, cache-friendly layer)
# so `pnpm install` can resolve the full workspace graph — pnpm requires
# every member listed in pnpm-workspace.yaml to be present, not just the one
# this image ultimately runs.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/customer-web/package.json apps/customer-web/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY services/drone-simulator/package.json services/drone-simulator/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

# Now the real source, and build just the API (and whatever workspace
# packages it depends on — `...` includes upstream workspace dependencies).
COPY apps/api apps/api
COPY packages packages
# The generated Prisma client (types + query engine) isn't checked in and
# has no postinstall hook — `nest build`'s typecheck fails without it. A
# placeholder DATABASE_URL is enough: `generate` only needs the schema to
# parse, it never actually connects.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    pnpm --filter @skynav/api exec prisma generate
RUN pnpm --filter @skynav/api... build
# NOT `pnpm prune --prod`: empirically (verified against this exact
# workspace) it also strips real, needed *production* symlinks like
# `reflect-metadata` from `apps/api/node_modules` — reproducible, not a
# one-off flake. A full `--prod` reinstall against the same frozen lockfile
# reconstructs a correct prod-only tree from scratch instead of trying to
# selectively remove from the existing one.
RUN CI=true pnpm install --prod --frozen-lockfile

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages /app/packages
COPY --from=build /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/package.json /app/apps/api/package.json
COPY --from=build /app/apps/api/prisma /app/apps/api/prisma

WORKDIR /app/apps/api
EXPOSE 4000
# Runs as the image's built-in non-root "node" user (present on the
# official node:22-slim image) rather than root.
USER node
CMD ["node", "dist/main.js"]
