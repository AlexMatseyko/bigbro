-- Users table (required before 001_profile_and_online_time.sql)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  department TEXT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  aspro_id TEXT
);
