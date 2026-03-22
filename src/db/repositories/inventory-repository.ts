import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { cardsTable, inventoryTable, priceCacheTable, setsTable, type InventoryRow } from "@/db/schema";

export async function getInventoryItems() {
  const db = getDb();
  return db.select().from(inventoryTable);
}

export async function getInventoryItemDetails() {
  const db = getDb();

  return db
    .select({
      inventoryId: inventoryTable.id,
      cardId: inventoryTable.cardId,
      quantity: inventoryTable.quantity,
      condition: inventoryTable.condition,
      priceUsd: inventoryTable.priceUsd,
      priceTimestamp: inventoryTable.priceTimestamp,
      addedAt: inventoryTable.addedAt,
      cardName: cardsTable.name,
      cardNumber: cardsTable.number,
      setId: cardsTable.setId,
      setName: setsTable.name,
      imageUrl: cardsTable.imageUrl,
      currentPriceUsd: priceCacheTable.currentPriceUsd
    })
    .from(inventoryTable)
    .leftJoin(cardsTable, eq(inventoryTable.cardId, cardsTable.id))
    .leftJoin(setsTable, eq(cardsTable.setId, setsTable.id))
    .leftJoin(priceCacheTable, eq(inventoryTable.cardId, priceCacheTable.cardId))
    .orderBy(desc(inventoryTable.addedAt));
}

export async function getInventoryItemByCardId(cardId: string) {
  const db = getDb();
  const rows = await db.select().from(inventoryTable).where(eq(inventoryTable.cardId, cardId)).limit(1);
  return rows[0] ?? null;
}

export async function saveInventoryItem(item: InventoryRow) {
  const db = getDb();
  await db.insert(inventoryTable).values(item).onConflictDoUpdate({
    target: inventoryTable.id,
    set: {
      quantity: item.quantity,
      condition: item.condition,
      priceUsd: item.priceUsd,
      priceTimestamp: item.priceTimestamp
    }
  });
}

export async function deleteInventoryItem(id: string) {
  const db = getDb();
  await db.delete(inventoryTable).where(eq(inventoryTable.id, id));
}

export async function updateInventoryPriceSnapshotByCardId(cardId: string, priceEur: number, priceTimestamp = new Date()) {
  const db = getDb();
  await db
    .update(inventoryTable)
    .set({
      priceEur,
      priceTimestamp
    })
    .where(eq(inventoryTable.cardId, cardId));
}