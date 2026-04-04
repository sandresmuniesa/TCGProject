import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import * as schema from "@/db/schema";

let database: ExpoSQLiteDatabase<typeof schema> | null = null;

// Full schema for fresh installations (includes all tables up to the latest migration).
const INITIAL_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

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

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
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
CREATE INDEX IF NOT EXISTS inventory_collection_id_idx ON inventory(collection_id);
`;

// The ID used for the auto-created initial collection during migration.
const MIGRATION_0001_INITIAL_COLLECTION_ID = "col_00000000000000_initial";

/**
 * Applies migration 0001 on existing databases that pre-date the collections feature.
 * Detection: inventory table lacks the collection_id column.
 * Safe to call multiple times — exits early if already applied.
 */
function applyMigration0001(sqlite: SQLiteDatabase): void {
  const row = sqlite.getFirstSync<{ name: string } | null>(
    "SELECT name FROM pragma_table_info('inventory') WHERE name = 'collection_id'"
  );
  if (row) {
    // Column already present — migration was already applied.
    return;
  }

  // Ensure at least one collection exists before assigning inventory items.
  const firstCollection = sqlite.getFirstSync<{ id: string } | null>(
    "SELECT id FROM collections LIMIT 1"
  );
  const collectionId = firstCollection?.id ?? MIGRATION_0001_INITIAL_COLLECTION_ID;

  if (!firstCollection) {
    sqlite.execSync(
      `INSERT INTO collections (id, name, created_at) VALUES ('${collectionId}', 'Mi colección', CAST(unixepoch('subsec') * 1000 AS INTEGER));`
    );
  }

  // Step 3: add nullable collection_id column.
  sqlite.execSync(`ALTER TABLE inventory ADD COLUMN collection_id TEXT;`);

  // Step 4: assign all existing rows to the initial collection.
  sqlite.execSync(
    `UPDATE inventory SET collection_id = '${collectionId}';`
  );

  // Step 5: recreate inventory with NOT NULL + FK + UNIQUE (rename+recreate pattern).
  sqlite.execSync(`
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
    INSERT INTO inventory_new (id, card_id, collection_id, quantity, condition, price_usd, price_timestamp, added_at)
      SELECT id, card_id, collection_id, quantity, condition, price_usd, price_timestamp, added_at
      FROM inventory;
    DROP TABLE inventory;
    ALTER TABLE inventory_new RENAME TO inventory;
    CREATE INDEX IF NOT EXISTS inventory_card_id_idx ON inventory(card_id);
    CREATE INDEX IF NOT EXISTS inventory_collection_id_idx ON inventory(collection_id);
  `);
}

export function getDb() {
  if (database) {
    return database;
  }

  const sqlite = openDatabaseSync("pokemon-tcg-collection.db");
  sqlite.execSync(INITIAL_SCHEMA_SQL);
  applyMigration0001(sqlite);
  database = drizzle(sqlite, { schema });

  return database;
}