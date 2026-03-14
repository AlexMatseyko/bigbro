#!/bin/bash
# Деплой Team Tracker (bigbro) на Ubuntu VPS
# Запуск: на сервере после ssh root@185.76.241.217
# Рекомендуется: скопировать скрипт на VPS и выполнить: chmod +x deploy-vps.sh && ./deploy-vps.sh

set -e
VPS_IP="185.76.241.217"
APP_DIR="/var/www/bigbro"
DB_USER="team_tracker"
DB_NAME="team_tracker"
# Пароль БД. Задайте при запуске: DB_PASS=ваш_пароль ./scripts/deploy-vps.sh
DB_PASS="${DB_PASS:?Задайте пароль БД: DB_PASS=yourpass ./scripts/deploy-vps.sh}"
NODE_VERSION="18"

echo "=== 1. Обновление системы и установка пакетов ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git postgresql postgresql-contrib curl

echo "=== 2. Node.js (если ещё не установлен) ==="
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "=== 3. PostgreSQL: пользователь и база ==="
sudo -u postgres psql -v ON_ERROR_STOP=1 <<EOSQL
DROP DATABASE IF EXISTS ${DB_NAME};
DROP USER IF EXISTS ${DB_USER};
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
EOSQL

echo "=== 4. Каталог приложения и клонирование ==="
mkdir -p /var/www
if [ -d "${APP_DIR}/.git" ]; then
  cd "${APP_DIR}"
  git fetch origin
  git reset --hard origin/main
else
  git clone https://github.com/AlexMatseyko/bigbro.git "${APP_DIR}"
  cd "${APP_DIR}"
fi

echo "=== 5. Файл .env ==="
if [ ! -f .env ]; then
  cat > .env <<'ENVFILE'
NODE_ENV=production
PORT=5000
PGUSER=team_tracker
PGHOST=localhost
PGDATABASE=team_tracker
PGPASSWORD=PLACEHOLDER_DB_PASSWORD
PGPORT=5432
JWT_SECRET=change-this-to-a-long-random-string-in-production
MANAGER_SECRET=change-manager-secret
ASPRO_API_BASE=https://alexligear1.aspro.cloud/api/v1
ASPRO_API_KEY=
ENVFILE
  sed -i "s/PLACEHOLDER_DB_PASSWORD/${DB_PASS}/" .env
  echo "Создан .env (пароль БД подставлен). Отредактируйте JWT_SECRET, MANAGER_SECRET, ASPRO_API_KEY: nano ${APP_DIR}/.env"
else
  echo ".env уже есть, не перезаписываю."
fi

echo "=== 6. Зависимости server ==="
cd "${APP_DIR}/server"
npm install --production

echo "=== 7. Миграции БД ==="
node scripts/run-migrations.js

echo "=== 8. Зависимости и сборка фронта ==="
cd "${APP_DIR}/app"
npm install
REACT_APP_API_URL="http://${VPS_IP}:5000" npm run build

echo "=== 9. PM2 ==="
npm install -g pm2
cd "${APP_DIR}/server"
pm2 delete team-tracker 2>/dev/null || true
NODE_ENV=production pm2 start index.js --name team-tracker
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo ""
echo "=== Готово. ==="
echo "Проверка: curl http://${VPS_IP}:5000/api/health"
echo "Сайт:      http://${VPS_IP}:5000"
echo "Логи:      pm2 logs team-tracker"
echo "После деплоя отредактируйте .env (JWT_SECRET, MANAGER_SECRET, ASPRO_API_KEY) и перезапустите: pm2 restart team-tracker"
