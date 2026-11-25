# SkyNav API — production image. Build from the REPO ROOT:
#   docker build -f apps/api/Dockerfile -t skynav-api .
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/customer-web/package.json apps/customer-web/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY services/drone-simulator/package.json services/drone-simulator/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages packages
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    pnpm --filter @skynav/api exec prisma generate
RUN pnpm --filter @skynav/api... build
RUN CI=true pnpm install --prod --frozen-lockfile --ignore-scripts

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
USER node
CMD ["node", "dist/main.js"]
