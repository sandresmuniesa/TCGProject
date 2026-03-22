import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { priceCacheTable, type PriceCacheRow } from "@/db/schema";

export async function getPriceCache(cardId: string) {
  const db = getDb();
  const rows = await db.select().from(priceCacheTable).where(eq(priceCacheTable.cardId, cardId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertPriceCache(entry: PriceCacheRow) {
  const db = getDb();
  await db.insert(priceCacheTable).values(entry).onConflictDoUpdate({
    target: priceCacheTable.cardId,
    set: {
      currentPriceUsd: entry.currentPriceUsd,
      previousPriceUsd: entry.previousPriceUsd,
      fetchedAt: entry.fetchedAt
    }
  });
}