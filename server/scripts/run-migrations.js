/**
 * Применяет SQL-миграции из папки migrations/ к базе данных.
 * Использует тот же db (pg Pool), что и приложение.
 * Запуск: node scripts/run-migrations.js (или npm run migrate из корня server)
 */
const path = require('path');
const fs = require('fs');

// Явно загружаем .env из корня проекта (server/scripts -> server -> корень)
const envPath = path.join(__dirname, '..', '..', '.env');
require('dotenv').config({ path: envPath });

if (!process.env.DATABASE_URL && (process.env.PGPASSWORD == null || process.env.PGPASSWORD === '')) {
  console.error('Ошибка: не задан PGPASSWORD. Проверьте файл .env в корне проекта:', envPath);
  console.error('Пример: PGPASSWORD=ваш_пароль');
  process.exit(1);
}

const db = require('../db');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function run() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('Нет файлов миграций в', MIGRATIONS_DIR);
    process.exit(0);
    return;
  }

  console.log('Миграции к применению:', files.join(', '));

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await db.query(sql);
      console.log('OK:', file);
    } catch (err) {
      console.error('Ошибка при выполнении', file, ':', err.message);
      process.exit(1);
    }
  }

  console.log('Все миграции применены.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
