#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  npm install
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://oficio:oficio@127.0.0.1:5432/oficio?schema=public}"
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

if [[ "${DATABASE_URL}" == *127.0.0.1* || "${DATABASE_URL}" == *localhost* ]]; then
  if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
    if command -v service >/dev/null 2>&1; then
      sudo service postgresql start || service postgresql start || true
    fi
  fi
fi

npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts
exec npx next dev -H 0.0.0.0 -p "${PORT:-43123}"
