import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { collectionsTable, type CollectionRow } from "@/db/schema";

export async function getAllCollections(): Promise<CollectionRow[]> {
  const db = getDb();
  return db.select().from(collectionsTable);
}

export async function getCollectionById(id: string): Promise<CollectionRow | null> {
  const db = getDb();
  const rows = await db.select().from(collectionsTable).where(eq(collectionsTable.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function insertCollection(row: CollectionRow): Promise<void> {
  const db = getDb();
  await db.insert(collectionsTable).values(row);
}

export async function updateCollectionName(id: string, name: string): Promise<void> {
  const db = getDb();
  await db.update(collectionsTable).set({ name }).where(eq(collectionsTable.id, id));
}

export async function deleteCollection(id: string): Promise<void> {
  const count = await getCollectionsCount();
  if (count <= 1) {
    throw new Error("No se puede eliminar la única colección existente.");
  }

  const db = getDb();
  await db.delete(collectionsTable).where(eq(collectionsTable.id, id));
}

export async function collectionExists(id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: collectionsTable.id })
    .from(collectionsTable)
    .where(eq(collectionsTable.id, id))
    .limit(1);
  return rows.length > 0;
}

export async function getCollectionsCount(): Promise<number> {
  const db = getDb();
  const result = await db.select({ count: sql<number>`count(*)` }).from(collectionsTable);
  return result[0]?.count ?? 0;
}
