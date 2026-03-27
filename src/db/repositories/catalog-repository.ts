import { and, asc, eq, inArray, like, or, sql } from "drizzle-orm";

import { getDb } from "@/db/client";
import { cardsTable, setsTable, type CardRow, type SetRow } from "@/db/schema";

/**
 * Appends '/low.webp' to any stored image_url that lacks a file extension.
 * Safe to call repeatedly — only affects un-normalized rows.
 */
export async function healCardImageUrls() {
  const db = getDb();
  await db.run(
    sql`UPDATE cards SET image_url = image_url || '/low.webp' WHERE image_url IS NOT NULL AND image_url NOT LIKE '%.webp' AND image_url NOT LIKE '%.png' AND image_url NOT LIKE '%.jpg'`
  );
}

export async function upsertSets(sets: SetRow[]) {
  const db = getDb();
  await db.insert(setsTable).values(sets).onConflictDoNothing();
}

export async function upsertCards(cards: CardRow[]) {
  const db = getDb();
  await db.insert(cardsTable).values(cards).onConflictDoNothing();
}

export async function getAllSets() {
  const db = getDb();
  return db.select().from(setsTable).orderBy(asc(setsTable.name));
}

export async function searchCardsByName(term: string) {
  const db = getDb();
  return db
    .select()
    .from(cardsTable)
    .where(like(cardsTable.name, `%${term}%`))
    .orderBy(asc(cardsTable.name));
}

export async function getCardsBySet(setId: string) {
  const db = getDb();
  return db.select().from(cardsTable).where(eq(cardsTable.setId, setId)).orderBy(asc(cardsTable.number));
}

export type SearchCatalogCardsParams = {
  term?: string;
  setId?: string;
  setIds?: string[];
};

export async function searchCatalogCards(params: SearchCatalogCardsParams) {
  const db = getDb();
  const normalizedTerm = params.term?.trim();
  const whereClauses = [];

  const activeSetIds = params.setIds && params.setIds.length > 0 ? params.setIds : params.setId ? [params.setId] : [];

  if (activeSetIds.length === 1) {
    whereClauses.push(eq(cardsTable.setId, activeSetIds[0]));
  } else if (activeSetIds.length > 1) {
    whereClauses.push(inArray(cardsTable.setId, activeSetIds));
  }

  if (normalizedTerm) {
    const pattern = `%${normalizedTerm}%`;
    whereClauses.push(or(like(cardsTable.name, pattern), like(cardsTable.number, pattern)));
  }

  if (whereClauses.length === 0) {
    return db.select().from(cardsTable).orderBy(asc(cardsTable.name), asc(cardsTable.number));
  }

  if (whereClauses.length === 1) {
    return db.select().from(cardsTable).where(whereClauses[0]).orderBy(asc(cardsTable.name), asc(cardsTable.number));
  }

  return db
    .select()
    .from(cardsTable)
    .where(and(whereClauses[0], whereClauses[1]))
    .orderBy(asc(cardsTable.name), asc(cardsTable.number));
}