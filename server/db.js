const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',         // твой пользователь PostgreSQL
  host: 'localhost',
  database: 'team_tracker', // база, которую создал
  password: '125MvG77',  // пароль пользователя postgres
  port: 5432,
});

module.exports = pool;