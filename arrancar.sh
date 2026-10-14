#!/usr/bin/env bash
set -euo pipefail

# arrancar.sh
# Automatiza la instalación y arranque en Termux (Postgres + Prisma + servidor)
# Uso: bash arrancar.sh

# Configuración por defecto (puedes editarlas si quieres)
DB_USER="fruteria"
DB_PASS="fruteria_pass"
DB_NAME="fruteria"
DB_PORT=5432
DB_HOST="localhost"

# Paths en Termux
PREFIX_DIR="${PREFIX:-/data/data/com.termux/files/usr}"
DB_DIR="$PREFIX_DIR/var/lib/postgresql"
LOGFILE="$DB_DIR/server.log"

echo "-- Arrancando script de despliegue para Termux --"

# 1) Instalar Postgres si no existe
if ! command -v psql >/dev/null 2>&1; then
  echo "Postgres no encontrado. Instalando via pkg... (puede pedir permisos)"
  pkg update -y || true
  pkg install -y postgresql
else
  echo "Postgres ya instalado."
fi

# 2) Inicializar cluster si no existe
if [ ! -d "$DB_DIR" ] || [ -z "$(ls -A "$DB_DIR" 2>/dev/null || true)" ]; then
  echo "Inicializando cluster de Postgres en $DB_DIR"
  mkdir -p "$DB_DIR"
  initdb -D "$DB_DIR"
else
  echo "Cluster de Postgres ya inicializado en $DB_DIR"
fi

# 3) Iniciar servicio Postgres (pg_ctl)
if pg_ctl -D "$DB_DIR" status >/dev/null 2>&1; then
  echo "Postgres ya está corriendo."
else
  echo "Iniciando Postgres..."
  pg_ctl -D "$DB_DIR" -l "$LOGFILE" start
  sleep 2
fi

# Esperar a que psql responda
echo "Esperando a que Postgres acepte conexiones..."
RETRIES=0
until psql -h "$DB_HOST" -p "$DB_PORT" -c "SELECT 1;" >/dev/null 2>&1; do
  RETRIES=$((RETRIES+1))
  if [ $RETRIES -gt 15 ]; then
    echo "ERROR: timeout esperando a Postgres. Revisa $LOGFILE"
    exit 1
  fi
  echo "  esperando... (intento $RETRIES)"
  sleep 1
done

# 4) Crear usuario y base de datos si no existen
echo "Creando usuario y base de datos si no existen..."
psql -v ON_ERROR_STOP=1 -c "DO 
\$\$BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
     CREATE ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASS}';
   END IF;
END\$\$;" || true

psql -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || psql -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\";"

# 5) Preparar variables de entorno para Prisma y servidor
export DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
export NODE_ENV="development"
export MERCADO_PAGO_ACCESS_TOKEN=""
export JWT_SECRET="change_this_secret"
export ADMIN_EMAIL="admin@fruteriasteve.com"
export ADMIN_PASSWORD="123456"
export USE_LOWDB=false

echo "DATABASE_URL set to $DATABASE_URL"

# 6) Instalar dependencias Node si hace falta
if [ ! -d "node_modules" ]; then
  echo "Instalando dependencias Node (npm install)"
  npm install
else
  echo "node_modules ya existe. Saltando npm install"
fi

# 7) Generar Prisma client y aplicar schema
echo "Generando Prisma client..."
npx prisma generate || true

echo "Aplicando esquema a la base (prisma db push)..."
npx prisma db push --accept-data-loss

# 8) Ejecutar seed
echo "Ejecutando seed..."
node prisma/seed.js || true

# 9) Construir frontend y levantar servidor
echo "Construyendo frontend (npm run build)..."
npm run build || true

echo "Iniciando servidor (node server/index.js) en segundo plano..."
nohup node server/index.js > server.log 2>&1 &

echo "Servidor iniciado. Accede en: http://localhost:4000"
echo "Logs de servidor: $(pwd)/server.log"

echo "Script finalizado." 
