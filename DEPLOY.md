# Вывод проекта Team Tracker на VPS

Пошаговая инструкция деплоя на VPS с установленным Node.js. Проект уже в GitHub: https://github.com/AlexMatseyko/bigbro

---

## Быстрый деплой одним скриптом (Ubuntu, root)

Подключитесь к VPS и выполните (подставьте свой пароль БД вместо `YOUR_DB_PASSWORD`):

```bash
ssh root@185.76.241.217
```

На сервере:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/AlexMatseyko/bigbro.git /var/www/bigbro
chmod +x /var/www/bigbro/scripts/deploy-vps.sh
DB_PASS=YOUR_DB_PASSWORD /var/www/bigbro/scripts/deploy-vps.sh
```

После деплоя отредактируйте на сервере `/var/www/bigbro/.env`: задайте `JWT_SECRET`, `MANAGER_SECRET`, `ASPRO_API_KEY`, затем выполните `pm2 restart team-tracker`. Сайт: http://185.76.241.217:5000

---

## Что нужно на VPS

- **Node.js** (уже установлен)
- **Git**
- **PostgreSQL** (база данных)
- **PM2** (запуск приложения в фоне, автозапуск после перезагрузки)

---

## Шаг 1. Подключение к VPS и обновление системы

```bash
ssh root@ВАШ_IP_VPS
# или: ssh пользователь@ВАШ_IP_VPS
```

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Шаг 2. Установка Git и PostgreSQL

```bash
sudo apt install -y git postgresql postgresql-contrib
```

Проверка Node.js:

```bash
node -v   # должно быть v16 или выше
npm -v
```

---

## Шаг 3. Настройка PostgreSQL

Создаём базу и пользователя:

```bash
sudo -u postgres psql
```

В консоли PostgreSQL выполните (подставьте свой пароль вместо `YOUR_DB_PASSWORD`):

```sql
CREATE USER team_tracker WITH PASSWORD 'YOUR_DB_PASSWORD';
CREATE DATABASE team_tracker OWNER team_tracker;
\q
```

Разрешить локальные подключения (если по умолчанию запрещено):

```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
```

Найдите строки с `local` и `127.0.0.1` и убедитесь, что для `team_tracker` или для `all` стоит `md5` (или `scram-sha-256`). Сохраните (Ctrl+O, Enter, Ctrl+X).

```bash
sudo systemctl restart postgresql
```

*(Номер версии в пути может быть 15 или 16 — смотрите каталог `/etc/postgresql/`.)*

---

## Шаг 4. Клонирование репозитория

Выберите каталог для приложения, например `/var/www` или домашний каталог:

```bash
cd /var/www
sudo git clone https://github.com/AlexMatseyko/bigbro.git
cd bigbro
```

Если репозиторий приватный, настройте SSH-ключ или Personal Access Token для Git.

---

## Шаг 5. Файл переменных окружения `.env`

Файл `.env` должен лежать в **корне проекта** (рядом с папками `app` и `server`).

```bash
nano .env
```

Минимальный набор (подставьте свои значения):

```env
NODE_ENV=production
PORT=5000

# База данных (либо DATABASE_URL, либо PG*)
PGUSER=team_tracker
PGHOST=localhost
PGDATABASE=team_tracker
PGPASSWORD=YOUR_DB_PASSWORD
PGPORT=5432

# Секреты приложения (обязательно смените)
JWT_SECRET=ваш_длинный_случайный_секрет_для_jwt
MANAGER_SECRET=секрет_для_входа_менеджера

# Aspro.Cloud (скопируйте из вашего локального .env)
ASPRO_API_BASE=https://alexligear1.aspro.cloud/api/v1
ASPRO_API_KEY=ваш_api_ключ
# при необходимости:
# ASPRO_CLIENT_ID=...
# ASPRO_CLIENT_SECRET=...
```

Сохраните: Ctrl+O, Enter, Ctrl+X.

---

## Шаг 6. Установка зависимостей

В корне проекта (`/var/www/bigbro`):

```bash
# Зависимости сервера
cd server && npm install --production && cd ..

# Зависимости фронтенда (нужны для сборки)
cd app && npm install && cd ..
```

---

## Шаг 7. Миграции базы данных

Запуск миграций из корня проекта (или из `server`):

```bash
cd /var/www/bigbro/server
node scripts/run-migrations.js
```

Должно вывести что-то вроде: `OK: 001_profile_and_online_time.sql`, `Все миграции применены.`

---

## Шаг 8. Сборка фронтенда

**Важно:** укажите URL вашего API. Либо домен без слеша в конце, либо `http://IP:5000`, если пока без домена.

```bash
cd /var/www/bigbro/app
REACT_APP_API_URL=https://ваш-домен.ru npm run build
# или по IP: REACT_APP_API_URL=http://ВАШ_IP:5000 npm run build
cd ..
```

После этого в `app/build` появится собранный фронтенд. В production сервер отдаёт его сам (одним процессом).

---

## Шаг 9. Установка PM2 и запуск приложения

Установка PM2 глобально:

```bash
sudo npm install -g pm2
```

Запуск сервера (из корня проекта):

```bash
cd /var/www/bigbro/server
NODE_ENV=production pm2 start index.js --name team-tracker
```

Проверка:

```bash
pm2 status
pm2 logs team-tracker
```

Сохранить список процессов PM2, чтобы после перезагрузки сервер поднялся сам:

```bash
pm2 save
pm2 startup
```

Команду из вывода `pm2 startup` нужно выполнить (скопировать и вставить в терминал).

---

## Шаг 10. Проверка

- **API:** `http://ВАШ_IP:5000/api/health` — должен вернуть JSON.
- **Сайт:** при `NODE_ENV=production` и наличии `app/build` открывайте `http://ВАШ_IP:5000` — должна открыться веб-форма входа.

Если фронт собран с `REACT_APP_API_URL=http://ВАШ_IP:5000`, запросы с страницы пойдут на этот же хост.

---

## (Опционально) Шаг 11. Nginx как reverse proxy и HTTPS

Установка Nginx и сертификата Let's Encrypt:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Сайт Nginx (подставьте свой домен):

```bash
sudo nano /etc/nginx/sites-available/team-tracker
```

Содержимое (замените `your-domain.com` на ваш домен):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Включить сайт и перезагрузить Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/team-tracker /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Получить SSL:

```bash
sudo certbot --nginx -d your-domain.com
```

После этого соберите фронт с `REACT_APP_API_URL=https://your-domain.com` и перезапустите приложение:

```bash
cd /var/www/bigbro/app && REACT_APP_API_URL=https://your-domain.com npm run build && cd ..
pm2 restart team-tracker
```

---

## Обновление проекта на VPS

После изменений в GitHub:

```bash
cd /var/www/bigbro
git pull

cd server && npm install --production && cd ..
cd app && npm install && REACT_APP_API_URL=https://ваш-домен.ru npm run build && cd ..

pm2 restart team-tracker
```

### Обновление только бэкенда (без пересборки фронта)

Если меняли только код в `server/` (например, новый эндпоинт):

```bash
cd /var/www/bigbro
git pull

cd server && npm install --production && cd ..
pm2 restart team-tracker
```

---

## Полезные команды PM2

| Команда | Описание |
|--------|----------|
| `pm2 status` | Список процессов |
| `pm2 logs team-tracker` | Логи |
| `pm2 restart team-tracker` | Перезапуск |
| `pm2 stop team-tracker` | Остановка |
| `pm2 delete team-tracker` | Удалить из PM2 |

---

## Переменные окружения (кратко)

| Переменная | Описание |
|------------|----------|
| `PORT` | Порт сервера (по умолчанию 5000) |
| `NODE_ENV` | `production` для деплоя |
| `PGUSER`, `PGHOST`, `PGDATABASE`, `PGPASSWORD`, `PGPORT` | Подключение к PostgreSQL (или один `DATABASE_URL`) |
| `JWT_SECRET` | Секрет для JWT (обязательно свой в production) |
| `MANAGER_SECRET` | Секрет для раздела менеджера |
| `ASPRO_API_BASE`, `ASPRO_API_KEY` | Интеграция с Aspro.Cloud |
| `REACT_APP_API_URL` | Задаётся только при сборке фронта (`npm run build`) |

Готово. После выполнения шагов 1–9 приложение будет работать на VPS по адресу `http://ВАШ_IP:5000`.
