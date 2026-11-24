FROM node:24.22.3-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN mkdir -p public
ARG NEXT_PUBLIC_SENTRY_DSN
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    PAYLOAD_SECRET=build-only-secret-not-for-production-12345 \
    SERVER_URL=http://localhost:3000 \
    ALLOW_INSECURE_LOCAL=true \
    SMTP_HOST=localhost SMTP_FROM_ADDRESS=build@example.test BUILD_WITHOUT_SMTP=true \
    NEXT_PUBLIC_SENTRY_DSN="$NEXT_PUBLIC_SENTRY_DSN" pnpm build

FROM node:24.22.3-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN corepack enable
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json
RUN mkdir -p /app/media && chown -R node:node /app/media
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
