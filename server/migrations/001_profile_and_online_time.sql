-- Add avatar column to users (path relative to uploads, e.g. avatars/user_123.jpg)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Daily online time per user, calendar day in Moscow (MSK, UTC+3)
CREATE TABLE IF NOT EXISTS user_daily_online (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_msk DATE NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date_msk)
);
