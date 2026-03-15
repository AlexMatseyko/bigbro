-- Таблицы (общие для всех пользователей): список таблиц из раздела «Таблицы»
CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Новая таблица',
  cells JSONB NOT NULL DEFAULT '{}',
  row_count INTEGER NOT NULL DEFAULT 35,
  methodist JSONB,
  theme INTEGER,
  col_widths JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
