#!/bin/sh
# One-time bootstrap for a fresh staging database (Render/Railway free
# tier - no Shell/one-off-job access there, see docs/DEPLOYMENT-LOWCOST.md
# §3). Set this file as the platform's temporary Docker Command override,
# let it run once against a fresh DATABASE_URL, then revert the override
# back to blank so future deploys go back to the Dockerfile's normal
# `npm run start` - re-running the seed/user-creation steps below a
# second time is not safe (duplicate data / duplicate user error).
set -e

npx medusa db:migrate
npx medusa exec ./src/migration-scripts/initial-data-seed.ts
npx medusa exec ./src/scripts/seed-business-config.ts
npx medusa user -e "${STAGING_ADMIN_EMAIL:?set STAGING_ADMIN_EMAIL}" -p "${STAGING_ADMIN_PASSWORD:?set STAGING_ADMIN_PASSWORD}"

npm run start
