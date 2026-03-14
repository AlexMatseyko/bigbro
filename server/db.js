const { Pool } = require('pg');

// На VPS задайте DATABASE_URL или отдельные PG* переменные в .env
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        user: process.env.PGUSER || 'postgres',
        host: process.env.PGHOST || 'localhost',
        database: process.env.PGDATABASE || 'team_tracker',
        password: process.env.PGPASSWORD,
        port: parseInt(process.env.PGPORT || '5432', 10),
      }
);

module.exports = pool;
