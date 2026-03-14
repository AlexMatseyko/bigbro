const path = require('path');
const { Pool } = require('pg');

// .env в корне проекта (рядом с app/ и server/) — нужно для миграций и скриптов
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// На VPS задайте DATABASE_URL или отдельные PG* переменные в .env
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.PGUSER || 'postgres',
        host: process.env.PGHOST || 'localhost',
        database: process.env.PGDATABASE || 'team_tracker',
        password: process.env.PGPASSWORD != null ? String(process.env.PGPASSWORD) : undefined,
        port: parseInt(process.env.PGPORT || '5432', 10),
      }
);

module.exports = pool;
