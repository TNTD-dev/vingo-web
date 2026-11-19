# Build: Node 24 build ra dist/. Chạy: Caddy phục vụ file tĩnh, ~15 MB RAM.
# TLS, nén và chia /api do Caddy của vingo-backend lo (deploy/Caddyfile bên đó).
FROM node:24-alpine AS build
WORKDIR /app
COPY . .
# postinstall chạy orval → sinh client từ contracts/vingo-openapi.yaml
RUN npm ci
# Biến VITE_* bị nhúng vào bundle lúc build, không đổi được ở runtime.
ARG VITE_SENTRY_DSN=
ARG VITE_SENTRY_ENVIRONMENT=
ARG SENTRY_RELEASE=
# true chỉ khi backend chạy SMS_PROVIDER=demo (staging demo): hiện mã OTP lên màn hình. Mặc định tắt.
ARG VITE_DEMO_OTP=false
ENV VITE_API_BASE=/api/v1 \
    VITE_USE_MOCK=false \
    VITE_DEMO_OTP=$VITE_DEMO_OTP \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT \
    SENTRY_RELEASE=$SENTRY_RELEASE
# Token Sentry đi qua build secret (không nằm trong layer/cache). Không có secret thì build bỏ qua upload source map.
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null)" npm run build

FROM caddy:2-alpine
LABEL org.opencontainers.image.source=https://github.com/TNTD-dev/vingo-web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
