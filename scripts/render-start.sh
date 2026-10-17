#!/bin/sh
# Arranque en Render (o en Docker). Migra y siembra de nuevo sin duplicar.
set -eu
cd /app

export NODE_ENV=production
# Render define HOSTNAME con el nombre interno de la máquina. Next se quedaría
# escuchando ahí y no en la red del proxy. Forzamos todas las interfaces.
export HOSTNAME=0.0.0.0
export PORT="${PORT:-10000}"
export DATABASE_URL="${DATABASE_URL:-file:/data/oficio.db}"
export OFICIO_TRUST_ORIGIN="${OFICIO_TRUST_ORIGIN:-1}"

db_path="${DATABASE_URL#file:}"
mkdir -p "$(dirname "$db_path")"

node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy
node scripts/seed-if-empty.mjs

export NODE_OPTIONS="--require /app/scripts/trust-proxy.cjs${NODE_OPTIONS:+ ${NODE_OPTIONS}}"
exec node server.js
