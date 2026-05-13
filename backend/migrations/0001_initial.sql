CREATE TABLE groups (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  rate       INTEGER NOT NULL DEFAULT 50,
  chip_rate  INTEGER NOT NULL DEFAULT 2,
  uma_1      INTEGER NOT NULL DEFAULT 20,
  uma_2      INTEGER NOT NULL DEFAULT 10,
  uma_3      INTEGER NOT NULL DEFAULT -10,
  uma_4      INTEGER NOT NULL DEFAULT -20,
  genten     INTEGER NOT NULL DEFAULT 25,
  kaeshi     INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE players (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id),
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE invite_tokens (
  token      TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL REFERENCES players(id),
  expires_at TEXT NOT NULL
);
