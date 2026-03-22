import { and, asc, eq, like, or } from "drizzle-orm";

import { getDb } from "@/db/client";
import { cardsTable, setsTable, type CardRow, type SetRow } from "@/db/schema";

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

type SearchCatalogCardsParams = {
  term?: string;
  setId?: string;
};

export async function searchCatalogCards(params: SearchCatalogCardsParams) {
  const db = getDb();
  const normalizedTerm = params.term?.trim();
  const whereClauses = [];

  if (params.setId) {
    whereClauses.push(eq(cardsTable.setId, params.setId));
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