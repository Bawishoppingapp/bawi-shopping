#!/bin/sh
set -eu

# One-time Render free-tier migration command. Render free services do not
# provide shell/one-off jobs, so this runs forward-only Medusa migrations
# before starting the already-built production server.
npx medusa db:migrate
cd .medusa/server
exec npm run start
