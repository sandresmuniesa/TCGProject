import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

import * as schema from "@/db/schema";

let database: ExpoSQLiteDatabase<typeof schema> | null = null;

export function getDb() {
  if (database) {
    return database;
  }

  const sqlite = openDatabaseSync("pokemon-tcg-collection.db");
  database = drizzle(sqlite, { schema });

  return database;
}