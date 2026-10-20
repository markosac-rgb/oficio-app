#!/bin/sh
# Arranca el paquete de producción. Solo necesita node en el PATH y PostgreSQL.
set -eu
cd "$(dirname "$0")"
ROOT="$(pwd)"

export NODE_ENV=production
export HOSTNAME=0.0.0.0
export PORT="${PORT:-43123}"
export OFICIO_TRUST_ORIGIN="${OFICIO_TRUST_ORIGIN:-1}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Define DATABASE_URL con la cadena de PostgreSQL." >&2
  exit 1
fi
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
export NODE_OPTIONS="--require ${ROOT}/trust-proxy.cjs${NODE_OPTIONS:+ ${NODE_OPTIONS}}"

exec node server.js
