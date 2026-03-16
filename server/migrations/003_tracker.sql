-- Статус пользователя в трекере: история смен статуса и задач
CREATE TABLE IF NOT EXISTS tracker (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  task TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

