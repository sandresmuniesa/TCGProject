CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  total_cards INTEGER NOT NULL DEFAULT 0,
  fetched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY NOT NULL,
  set_id TEXT NOT NULL,
  number TEXT NOT NULL,
  name TEXT NOT NULL,
  image_url TEXT,
  fetched_at INTEGER NOT NULL,
  FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  condition TEXT NOT NULL,
  price_usd REAL,
  price_timestamp INTEGER,
  added_at INTEGER NOT NULL,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS price_cache (
  card_id TEXT PRIMARY KEY NOT NULL,
  current_price_usd REAL NOT NULL,
  previous_price_usd REAL,
  fetched_at INTEGER NOT NULL,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS cards_set_id_idx ON cards(set_id);
CREATE INDEX IF NOT EXISTS cards_name_idx ON cards(name);
CREATE INDEX IF NOT EXISTS inventory_card_id_idx ON inventory(card_id);