-- chip_rate / genten / kaeshi をスコア単位から点数単位に変更
-- SQLite は ALTER COLUMN DEFAULT 非対応のためテーブル再作成

PRAGMA foreign_keys = OFF;

CREATE TABLE groups_new (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  rate       INTEGER NOT NULL DEFAULT 50,
  chip_rate  INTEGER NOT NULL DEFAULT 2000,
  uma_1      INTEGER NOT NULL DEFAULT 20,
  uma_2      INTEGER NOT NULL DEFAULT 10,
  uma_3      INTEGER NOT NULL DEFAULT -10,
  uma_4      INTEGER NOT NULL DEFAULT -20,
  genten     INTEGER NOT NULL DEFAULT 25000,
  kaeshi     INTEGER NOT NULL DEFAULT 30000,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 既存データをスコア→点数に変換して移行
INSERT INTO groups_new
  SELECT id, name, rate,
         chip_rate * 1000,
         uma_1, uma_2, uma_3, uma_4,
         genten * 1000,
         kaeshi * 1000,
         created_at
  FROM groups;

DROP TABLE groups;
ALTER TABLE groups_new RENAME TO groups;

PRAGMA foreign_keys = ON;
