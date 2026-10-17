#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  npm install
fi

export DATABASE_URL="${DATABASE_URL:-file:./dev.db}"
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts
exec npx next dev -H 0.0.0.0 -p "${PORT:-43123}"
