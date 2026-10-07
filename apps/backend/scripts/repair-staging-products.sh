#!/bin/sh
# Explicit one-time recovery for an already-bootstrapped staging database that
# was affected by the historical partial seed. Temporarily set this as the
# platform Docker Command, wait for the service to become Live, then clear the
# override so future deploys use the normal non-mutating server startup.
set -e

npx medusa exec ./src/scripts/repair-initial-products.ts

cd .medusa/server
exec npm run start
