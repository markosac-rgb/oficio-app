#!/bin/sh
# Arranca el paquete de producción. Solo necesita node en el PATH.
set -eu
cd "$(dirname "$0")"
ROOT="$(pwd)"

export NODE_ENV=production
export HOSTNAME=0.0.0.0
export PORT="${PORT:-43123}"
export DATABASE_URL="${DATABASE_URL:-file:${ROOT}/data/oficio.db}"
export OFICIO_TRUST_ORIGIN="${OFICIO_TRUST_ORIGIN:-1}"
export NODE_OPTIONS="--require ${ROOT}/trust-proxy.cjs${NODE_OPTIONS:+ ${NODE_OPTIONS}}"

exec node server.js
