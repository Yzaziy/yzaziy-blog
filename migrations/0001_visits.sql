CREATE TABLE IF NOT EXISTS site_visits (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  total INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(total) = 'integer' AND total BETWEEN 0 AND 9007199254740991)
);
INSERT OR IGNORE INTO site_visits (id, total) VALUES (1, 0);
