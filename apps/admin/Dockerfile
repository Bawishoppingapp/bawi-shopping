# Bawi Shopping — admin portal (Next.js, includes the courier portal at
# /courier/*) production image.
#
# Monorepo app - depends on the workspace package @bawi/ui, so the build
# context for this file MUST be the repository root, not apps/admin/.
#
#   docker build -f apps/admin/Dockerfile -t bawi-admin .
#
# Relies on next.config.ts's `output: "standalone"` - see
# apps/storefront/Dockerfile's header comment for why.

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/admin apps/admin
COPY packages/ui packages/ui
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@bawi/admin

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S bawi && adduser -S bawi -G bawi
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build /app/apps/admin/public ./apps/admin/public
WORKDIR /app/apps/admin
USER bawi
EXPOSE 3002
ENV PORT=3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3002/ || exit 1
CMD ["node", "server.js"]
