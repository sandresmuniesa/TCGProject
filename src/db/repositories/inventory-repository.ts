import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { cardsTable, collectionsTable, inventoryTable, priceCacheTable, setsTable, type InventoryRow } from "@/db/schema";

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
      collectionId: inventoryTable.collectionId,
      collectionName: collectionsTable.name,
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
    .leftJoin(collectionsTable, eq(inventoryTable.collectionId, collectionsTable.id))
    .orderBy(desc(inventoryTable.addedAt));
}

export async function getInventoryItemByCardId(cardId: string, collectionId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.cardId, cardId), eq(inventoryTable.collectionId, collectionId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getInventoryItemByCardIdCollectionIdAndCondition(
  cardId: string,
  collectionId: string,
  condition: string
) {
  const db = getDb();
  const rows = await db
    .select()
    .from(inventoryTable)
    .where(
      and(
        eq(inventoryTable.cardId, cardId),
        eq(inventoryTable.collectionId, collectionId),
        eq(inventoryTable.condition, condition as InventoryRow["condition"])
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getInventoryItemsByCollectionId(collectionId: string): Promise<InventoryRow[]> {
  const db = getDb();
  return db.select().from(inventoryTable).where(eq(inventoryTable.collectionId, collectionId));
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

/**
 * Updates the price snapshot for a specific inventory entry by its inventoryId.
 * Replaces the previous updateInventoryPriceSnapshotByCardId (which updated all
 * entries sharing the same cardId, ignoring collection boundaries).
 */
export async function updateInventoryPriceSnapshot(
  inventoryId: string,
  priceUsd: number,
  priceTimestamp = new Date()
) {
  const db = getDb();
  await db
    .update(inventoryTable)
    .set({ priceUsd, priceTimestamp })
    .where(eq(inventoryTable.id, inventoryId));
}

/**
 * Moves all inventory entries from `fromCollectionId` to `toCollectionId`.
 * When an entry would collide on UNIQUE(card_id, collection_id, condition), the
 * quantities are merged into the target entry and the source entry is deleted.
 */
export async function reassignInventoryItems(
  fromCollectionId: string,
  toCollectionId: string
): Promise<void> {
  const db = getDb();

  const fromItems = await db
    .select()
    .from(inventoryTable)
    .where(eq(inventoryTable.collectionId, fromCollectionId));

  if (fromItems.length === 0) {
    return;
  }

  const toItems = await db
    .select()
    .from(inventoryTable)
    .where(eq(inventoryTable.collectionId, toCollectionId));

  const toItemIndex = new Map(
    toItems.map((item) => [`${item.cardId}::${item.condition}`, item])
  );

  for (const fromItem of fromItems) {
    const collisionKey = `${fromItem.cardId}::${fromItem.condition}`;
    const toItem = toItemIndex.get(collisionKey);

    if (toItem) {
      // Merge: sum quantities into the target entry, then delete the source entry.
      await db
        .update(inventoryTable)
        .set({ quantity: toItem.quantity + fromItem.quantity })
        .where(eq(inventoryTable.id, toItem.id));
      await db.delete(inventoryTable).where(eq(inventoryTable.id, fromItem.id));
    } else {
      // No collision: simply reassign the entry to the target collection.
      await db
        .update(inventoryTable)
        .set({ collectionId: toCollectionId })
        .where(eq(inventoryTable.id, fromItem.id));
      // Update the index so subsequent iterations see this entry as "in target".
      toItemIndex.set(collisionKey, { ...fromItem, collectionId: toCollectionId });
    }
  }
}

export async function getInventoryItemById(id: string): Promise<InventoryRow | null> {
  const db = getDb();
  const rows = await db.select().from(inventoryTable).where(eq(inventoryTable.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Updates only the collectionId of an existing inventory entry.
 * Used when moving a single entry between collections without changing other fields.
 */
export async function updateInventoryCollectionId(inventoryId: string, collectionId: string): Promise<void> {
  const db = getDb();
  await db.update(inventoryTable).set({ collectionId }).where(eq(inventoryTable.id, inventoryId));
}