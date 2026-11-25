# SkyNav Admin Web — production image. Build from REPO ROOT:
#   docker build -f apps/admin-web/Dockerfile -t skynav-admin-web .
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

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

COPY packages packages
COPY apps/admin-web apps/admin-web
RUN pnpm --filter @skynav/admin-web build

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/admin-web/dist /usr/share/nginx/html
RUN echo 'server { \
    listen 3001; \
    server_name localhost; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    location /api/ { \
        proxy_pass http://api:4000; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_cache_bypass $http_upgrade; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3001
CMD ["nginx", "-g", "daemon off;"]
