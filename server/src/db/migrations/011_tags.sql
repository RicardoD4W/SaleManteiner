CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL CHECK (scope IN ('buy', 'sold')),
  name TEXT NOT NULL COLLATE NOCASE,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (scope, name)
);

ALTER TABLE buys ADD COLUMN tag_id INTEGER REFERENCES tags(id) ON DELETE SET NULL;

CREATE INDEX idx_buys_tag_id ON buys(tag_id);
