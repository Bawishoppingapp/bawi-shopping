# Bawi Shopping — storefront (Next.js) production image.
#
# Monorepo app - depends on the workspace packages @bawi/ui and
# @bawi/i18n, so the build context for this file MUST be the repository
# root, not apps/storefront/.
#
#   docker build -f apps/storefront/Dockerfile -t bawi-storefront .
#
# Relies on next.config.ts's `output: "standalone"` (see docs/DEPLOYMENT.md),
# which makes Next.js trace and copy only the dependencies this app
# actually needs into .next/standalone - including the hoisted workspace
# packages - so the runner stage doesn't need a full node_modules copy.

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/storefront/package.json apps/storefront/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/i18n/package.json packages/i18n/package.json
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/storefront apps/storefront
COPY packages/ui packages/ui
COPY packages/i18n packages/i18n
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@bawi/storefront

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S bawi && adduser -S bawi -G bawi
COPY --from=build /app/apps/storefront/.next/standalone ./
COPY --from=build /app/apps/storefront/.next/static ./apps/storefront/.next/static
COPY --from=build /app/apps/storefront/public ./apps/storefront/public
WORKDIR /app/apps/storefront
USER bawi
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
