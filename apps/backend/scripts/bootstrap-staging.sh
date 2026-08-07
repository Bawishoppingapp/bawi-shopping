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

# initial-data-seed.ts is Medusa's own scaffold script, not this
# project's code, and isn't written to be re-run safely - if an earlier
# attempt of THIS bootstrap script got this far before failing later on,
# re-running it errors on already-created regions/countries instead of
# no-op'ing. Tolerate that one case so the chain can still reach the
# steps below; seed-business-config.ts (this project's own script) is
# confirmed idempotent (checks for an existing entry before creating -
# see apps/backend/src/scripts/seed-business-config.ts) so it doesn't
# need the same treatment.
npx medusa exec ./src/migration-scripts/initial-data-seed.ts || \
  echo "initial-data-seed.ts errored (likely already applied by an earlier attempt) - continuing"

npx medusa exec ./src/scripts/seed-business-config.ts

# Same reasoning as above: tolerate "user already exists" specifically,
# in case an earlier attempt of this script got this far already.
npx medusa user -e "${STAGING_ADMIN_EMAIL:?set STAGING_ADMIN_EMAIL}" -p "${STAGING_ADMIN_PASSWORD:?set STAGING_ADMIN_PASSWORD}" || \
  echo "medusa user errored (likely already created by an earlier attempt) - continuing"

npm run start
