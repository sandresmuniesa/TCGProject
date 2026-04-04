-- Migration 0001: Introduce collections and link inventory to collections.
-- Uses the SQLite rename+recreate pattern for structural changes to inventory
-- (SQLite does not support ADD COLUMN NOT NULL or ADD FOREIGN KEY via ALTER TABLE).

-- Step 1: Create the collections table
CREATE TABLE collections (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Step 2: Insert the initial "Mi colección"
INSERT INTO collections (id, name, created_at)
VALUES (
  'col_00000000000000_initial',
  'Mi colección',
  CAST(unixepoch('subsec') * 1000 AS INTEGER)
);

-- Step 3: Add collection_id as nullable to inventory
-- (SQLite only allows nullable columns in ADD COLUMN)
ALTER TABLE inventory ADD COLUMN collection_id TEXT;

-- Step 4: Assign all existing inventory rows to the initial collection
UPDATE inventory SET collection_id = 'col_00000000000000_initial';

-- Step 5a: Create the new inventory table with NOT NULL, FK, and UNIQUE constraint
CREATE TABLE inventory_new (
  id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  condition TEXT NOT NULL,
  price_usd REAL,
  price_timestamp INTEGER,
  added_at INTEGER NOT NULL,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE RESTRICT,
  UNIQUE(card_id, collection_id, condition)
);

-- Step 5b: Copy all data from old inventory to new table
INSERT INTO inventory_new (id, card_id, collection_id, quantity, condition, price_usd, price_timestamp, added_at)
SELECT id, card_id, collection_id, quantity, condition, price_usd, price_timestamp, added_at
FROM inventory;

-- Step 5c: Drop old inventory table
DROP TABLE inventory;

-- Step 5d: Rename new table to inventory
ALTER TABLE inventory_new RENAME TO inventory;

-- Restore existing index and add new index for collection_id lookups
CREATE INDEX IF NOT EXISTS inventory_card_id_idx ON inventory(card_id);
CREATE INDEX IF NOT EXISTS inventory_collection_id_idx ON inventory(collection_id);
