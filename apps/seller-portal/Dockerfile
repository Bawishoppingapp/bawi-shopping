# Bawi Shopping — seller portal (Next.js) production image.
#
# Monorepo app - depends on the workspace package @bawi/ui, so the build
# context for this file MUST be the repository root, not
# apps/seller-portal/.
#
#   docker build -f apps/seller-portal/Dockerfile -t bawi-seller-portal .
#
# Relies on next.config.ts's `output: "standalone"` - see
# apps/storefront/Dockerfile's header comment for why.

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/seller-portal/package.json apps/seller-portal/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/seller-portal apps/seller-portal
COPY packages/ui packages/ui
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@bawi/seller-portal

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S bawi && adduser -S bawi -G bawi
COPY --from=build /app/apps/seller-portal/.next/standalone ./
COPY --from=build /app/apps/seller-portal/.next/static ./apps/seller-portal/.next/static
COPY --from=build /app/apps/seller-portal/public ./apps/seller-portal/public
WORKDIR /app/apps/seller-portal
USER bawi
EXPOSE 3001
ENV PORT=3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/ || exit 1
CMD ["node", "server.js"]
