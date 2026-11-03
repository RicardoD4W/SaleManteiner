ALTER TABLE customers ADD COLUMN phone TEXT;
ALTER TABLE customers ADD COLUMN address TEXT;
ALTER TABLE customers ADD COLUMN notes TEXT;

ALTER TABLE solds ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0;

CREATE TABLE expense_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  concept      TEXT NOT NULL,
  amount       REAL NOT NULL DEFAULT 0,
  category_id  INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  expense_date TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category_id);
