#!/bin/sh
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ifg_rede}"
DB_USER="${DB_USER:-ifg}"
DB_PASSWORD="${DB_PASSWORD:-ifgpass}"

echo "Aplicando migrações..."
python manage.py migrate --noinput

echo "Verificando se o banco está populado..."
COUNT=$(python manage.py shell -c "from apps.network.models import Researcher; print(Researcher.objects.count())")

if [ "$COUNT" = "0" ]; then
  echo "Banco vazio — importando dados..."
  python manage.py import_data
else
  echo "Banco já populado ($COUNT pesquisadores) — pulando import."
fi

exec "$@"