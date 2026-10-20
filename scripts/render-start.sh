#!/bin/sh
# Arranque en Render (o en Docker). Migra y siembra sin borrar datos.
set -eu
cd /app

export NODE_ENV=production
# Render define HOSTNAME con el nombre interno de la máquina. Next se quedaría
# escuchando ahí y no en la red del proxy. Forzamos todas las interfaces.
export HOSTNAME=0.0.0.0
export PORT="${PORT:-10000}"
export OFICIO_TRUST_ORIGIN="${OFICIO_TRUST_ORIGIN:-1}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL. Tiene que ser una cadena de PostgreSQL." >&2
  exit 1
fi
# Las migraciones usan la conexión directa. En runtime la app usa DATABASE_URL.
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

node /opt/prisma-cli/node_modules/prisma/build/index.js migrate deploy
node scripts/seed-if-empty.mjs

export NODE_OPTIONS="--require /app/scripts/trust-proxy.cjs${NODE_OPTIONS:+ ${NODE_OPTIONS}}"
exec node server.js
