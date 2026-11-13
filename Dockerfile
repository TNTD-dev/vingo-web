# Build: Node 24 build ra dist/. Chạy: Caddy phục vụ file tĩnh, ~15 MB RAM.
# TLS, nén và chia /api do Caddy của vingo-backend lo (deploy/Caddyfile bên đó).
FROM node:24-alpine AS build
WORKDIR /app
COPY . .
# postinstall chạy orval → sinh client từ contracts/vingo-openapi.yaml
RUN npm ci
# Biến VITE_* bị nhúng vào bundle lúc build, không đổi được ở runtime.
ARG VITE_SENTRY_DSN=
ENV VITE_API_BASE=/api/v1 \
    VITE_USE_MOCK=false \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN npm run build

FROM caddy:2-alpine
LABEL org.opencontainers.image.source=https://github.com/TNTD-dev/vingo-web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
