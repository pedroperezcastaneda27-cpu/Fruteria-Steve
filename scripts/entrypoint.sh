#!/bin/sh
set -e

# Entry script for container startup:
# - Waits for DATABASE_URL
# - Runs prisma migrate deploy (with retries)
# - Falls back to prisma db push if migrate fails (e.g., no migrations)
# - Runs prisma seed script
# - Starts the node server

echo "Starting entrypoint script..."

if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL is set. Attempting to run migrations against: ${DATABASE_URL}" 

  ATTEMPTS=0
  MAX_ATTEMPTS=10
  SLEEP_SECONDS=3

  until npx prisma migrate deploy; do
    ATTEMPTS=$((ATTEMPTS+1))
    echo "prisma migrate deploy failed (attempt: ${ATTEMPTS}). Retrying in ${SLEEP_SECONDS}s..."
    if [ ${ATTEMPTS} -ge ${MAX_ATTEMPTS} ]; then
      echo "prisma migrate deploy failed after ${ATTEMPTS} attempts. Falling back to 'prisma db push'."
      npx prisma db push --accept-data-loss || true
      break
    fi
    sleep ${SLEEP_SECONDS}
  done

  echo "Running prisma generate"
  npx prisma generate || true

  echo "Running seed script"
  node prisma/seed.js || true
else
  echo "DATABASE_URL not set. Skipping migrations and seed. The app will run in local (lowdb) fallback mode or expect an external DB later."
fi

# Start the server
echo "Starting server..."
node server/index.js
