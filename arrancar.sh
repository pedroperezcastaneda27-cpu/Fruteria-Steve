#!/usr/bin/env bash
set -euo pipefail

PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
export PATH="$PREFIX/bin:$PATH"

PGDATA="${PGDATA:-$HOME/.local/share/postgresql/fruteria_data}"
LOGFILE="$PGDATA/logfile"

if [ ! -x "$PREFIX/bin/initdb" ] || [ ! -x "$PREFIX/bin/pg_ctl" ] || [ ! -x "$PREFIX/bin/psql" ]; then
  echo "Error: initdb, pg_ctl o psql no están en $PREFIX/bin" >&2
  echo "Instala PostgreSQL en Termux: pkg install postgresql" >&2
  exit 1
fi

mkdir -p "$PGDATA"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "Inicializando PostgreSQL en $PGDATA..."
  "$PREFIX/bin/initdb" -D "$PGDATA"
fi

if ! "$PREFIX/bin/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  echo "Iniciando PostgreSQL..."
  "$PREFIX/bin/pg_ctl" -D "$PGDATA" -l "$LOGFILE" start -w
fi

echo "Verificando base de datos 'fruteria'..."
if ! "$PREFIX/bin/psql" -Atq -d postgres -c "SELECT 1 FROM pg_database WHERE datname='fruteria'" | grep -q 1; then
  echo "Creando base de datos 'fruteria'..."
  "$PREFIX/bin/createdb" -h "$PGHOST" -p 5432 -U postgres fruteria 2>/dev/null || \
  "$PREFIX/bin/psql" -d postgres -c "CREATE DATABASE fruteria;"
fi

echo "PostgreSQL listo. Base 'fruteria' disponible."
