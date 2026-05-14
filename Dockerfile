# syntax=docker/dockerfile:1.7

# Multi-stage build for MineCraft Bot Assistant.
# Frontend assets are architecture-neutral, so build them on the native
# builder platform to avoid qemu illegal-instruction failures during npm ci.

FROM --platform=$BUILDPLATFORM node:20-bookworm-slim AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY index.html vite.config.ts tailwind.config.ts postcss.config.js tsconfig*.json ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

FROM node:20-bookworm-slim AS server-deps

WORKDIR /app/server

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY server/package.json server/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:20-bookworm-slim AS production

ARG TARGETARCH
ARG SING_BOX_VERSION=1.10.7
ARG INSTALL_SING_BOX=true

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl tar tzdata \
    && rm -rf /var/lib/apt/lists/*

RUN if [ "$INSTALL_SING_BOX" = "true" ]; then \
      case "$TARGETARCH" in \
        amd64) sing_arch="amd64" ;; \
        arm64) sing_arch="arm64" ;; \
        *) echo "Unsupported TARGETARCH for sing-box: $TARGETARCH" >&2; exit 1 ;; \
      esac; \
      curl -fsSL -o /tmp/sing-box.tar.gz \
        "https://github.com/SagerNet/sing-box/releases/download/v${SING_BOX_VERSION}/sing-box-${SING_BOX_VERSION}-linux-${sing_arch}.tar.gz"; \
      tar -xzf /tmp/sing-box.tar.gz -C /tmp; \
      install -m 0755 "/tmp/sing-box-${SING_BOX_VERSION}-linux-${sing_arch}/sing-box" /usr/local/bin/sing-box; \
      rm -rf /tmp/sing-box*; \
    fi

COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=frontend-builder /app/dist ./dist/

RUN mkdir -p /app/server/data /app/server/logs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:3000/api/auth/check || exit 1

WORKDIR /app/server
CMD ["node", "index.js"]
