import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { CARD_CONDITIONS } from "@/constants/card-condition";

export const setsTable = sqliteTable("sets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  totalCards: integer("total_cards").notNull().default(0),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull()
});

export const cardsTable = sqliteTable("cards", {
  id: text("id").primaryKey(),
  setId: text("set_id")
    .notNull()
    .references(() => setsTable.id, { onDelete: "cascade" }),
  number: text("number").notNull(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull()
});

export const inventoryTable = sqliteTable("inventory", {
  id: text("id").primaryKey(),
  cardId: text("card_id")
    .notNull()
    .references(() => cardsTable.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  condition: text("condition", { enum: CARD_CONDITIONS }).notNull(),
  priceUsd: real("price_usd"),
  priceTimestamp: integer("price_timestamp", { mode: "timestamp_ms" }),
  addedAt: integer("added_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`)
});

export const priceCacheTable = sqliteTable("price_cache", {
  cardId: text("card_id")
    .primaryKey()
    .references(() => cardsTable.id, { onDelete: "cascade" }),
  currentPriceUsd: real("current_price_usd").notNull(),
  previousPriceUsd: real("previous_price_usd"),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull()
});

export type SetRow = typeof setsTable.$inferSelect;
export type CardRow = typeof cardsTable.$inferSelect;
export type InventoryRow = typeof inventoryTable.$inferSelect;
export type PriceCacheRow = typeof priceCacheTable.$inferSelect;