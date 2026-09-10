# Bawi Shopping — backend (Medusa) production image.
#
# This is an npm-workspaces monorepo: apps/backend depends on the
# workspace package @bawi/search-contract, which only resolves correctly
# through the root lockfile/workspace install - so the build context for
# this file MUST be the repository root, not apps/backend/.
#
#   docker build -f apps/backend/Dockerfile -t bawi-backend .
#
# See docs/DEPLOYMENT.md for full environment-variable and deployment
# documentation - this file only builds and runs the process; it sets no
# secrets and enables no live/production feature flags itself.

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY scripts scripts
COPY apps/backend/package.json apps/backend/package.json
COPY packages/search-contract/package.json packages/search-contract/package.json
# Full install (including devDependencies) - the build step below needs
# TypeScript and Medusa's build tooling. A smaller runtime-only image is a
# legitimate future optimization; correctness of the workspace-linked
# @bawi/search-contract dependency comes first (see header comment).
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/backend apps/backend
COPY packages/search-contract packages/search-contract
RUN npm run build --workspace=@bawi/backend

FROM base AS runner
ENV NODE_ENV=production
# --chown here (not a later `RUN chown -R`) matters: Medusa's migration
# runner writes into node_modules/@medusajs/*/dist/migrations at runtime
# for modules that don't ship one yet (confirmed against a real EACCES
# failure - `npx medusa db:migrate` as the non-root `bawi` user, against
# node_modules copied in as root with no ownership flag, failed on every
# such mkdir). This affects any environment's *first* migrate run against
# a fresh database, not just Render - see docs/DEPLOYMENT-LOWCOST.md §3.
RUN addgroup -S bawi && adduser -S bawi -G bawi
COPY --from=build --chown=bawi:bawi /app/node_modules ./node_modules
COPY --from=build --chown=bawi:bawi /app/package.json ./package.json
COPY --from=build --chown=bawi:bawi /app/apps/backend ./apps/backend
COPY --from=build --chown=bawi:bawi /app/packages/search-contract ./packages/search-contract
WORKDIR /app/apps/backend
USER bawi
EXPOSE 9000
# Medusa's own /health route (see docs/DEPLOYMENT.md §1) - used here and
# by infra/terraform's ALB target group health check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:9000/health || exit 1
# `medusa start` must run from WITHIN .medusa/server, not apps/backend -
# .medusa/server is a separate, self-contained deployable output (its own
# package.json) that the admin UI's static-file path resolves relative
# to. Running it from apps/backend instead (as an earlier version of this
# Dockerfile did) reproducibly fails with "Could not find index.html in
# the admin build directory" - confirmed by reproducing and fixing this
# locally (see docs/DEPLOYMENT-LOWCOST.md §3), not guessed. node_modules
# resolution still works from here since Node walks up to /app/node_
# modules same as it does from apps/backend directly.
# Migrations are NOT run automatically on container start (see
# docs/DEPLOYMENT.md/docs/DATABASE.md §6: migrations run as their own
# explicit step, staging before production, never implicitly on boot) -
# and still run from apps/backend (via Shell or bootstrap-staging.sh),
# not from here, since they use ts-node against the original src/ tree.
CMD ["sh", "-c", "cd .medusa/server && npm run start"]
