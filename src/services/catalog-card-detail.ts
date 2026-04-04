import { Platform } from "react-native";

import type { CardCondition } from "@/constants/card-condition";
import type { CatalogCardMetadata, MyCardCopy, MyCardCopiesSummary } from "@/services/types";

// ---------------------------------------------------------------------------
// Web localStorage keys (mirrors constants in other services)
// ---------------------------------------------------------------------------

const WEB_SETS_KEY = "tcg:catalog:sets:v1";
const WEB_CARDS_KEY_PREFIX = "tcg:catalog:cards:set:v2:";
const WEB_INVENTORY_KEY = "tcg:inventory:items:v2";
const WEB_COLLECTIONS_KEY = "tcg:collections:v1";

// ---------------------------------------------------------------------------
// Minimal web row shapes (avoid cross-importing full service types)
// ---------------------------------------------------------------------------

type WebSetRow = { id: string; name: string };

type WebCardRow = {
  id: string;
  setId: string;
  number: string;
  name: string;
  imageUrl?: string | null;
};

type WebInventoryRow = {
  id: string;
  cardId: string;
  collectionId: string;
  quantity: number;
  condition: CardCondition;
  priceUsd?: number | null;
  priceTimestamp?: string | number | Date | null;
};

type WebCollectionRow = { id: string; name: string };

// ---------------------------------------------------------------------------
// Deps type and defaults
// ---------------------------------------------------------------------------

type NativeCardWithSet = {
  id: string;
  setId: string;
  number: string;
  name: string;
  imageUrl: string | null;
  setName: string;
};

type NativeCopyRow = {
  inventoryId: string;
  collectionId: string;
  collectionName: string | null;
  quantity: number;
  condition: CardCondition;
  priceUsd: number | null;
  priceTimestamp: Date | null;
};

type CatalogCardDetailDeps = {
  platformOS: string;
  getCardWithSetById: (cardId: string) => Promise<NativeCardWithSet | null>;
  getInventoryCopiesByCardId: (cardId: string) => Promise<NativeCopyRow[]>;
  readWebSets: () => WebSetRow[];
  readWebCardsBySetId: (setId: string) => WebCardRow[];
  readWebInventoryRows: () => WebInventoryRow[];
  readWebCollections: () => WebCollectionRow[];
};

function readWebArrayItem<T>(key: string): T[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const defaultDeps: CatalogCardDetailDeps = {
  platformOS: Platform.OS,

  getCardWithSetById: async (cardId) => {
    const { getCardWithSetById } = await import("@/db/repositories/catalog-repository");
    return getCardWithSetById(cardId);
  },

  getInventoryCopiesByCardId: async (cardId) => {
    const { getInventoryCopiesByCardId } = await import("@/db/repositories/inventory-repository");
    const rows = await getInventoryCopiesByCardId(cardId);
    return rows.map((r) => ({
      inventoryId: r.inventoryId,
      collectionId: r.collectionId,
      collectionName: r.collectionName,
      quantity: r.quantity,
      condition: r.condition,
      priceUsd: r.priceUsd ?? null,
      priceTimestamp: r.priceTimestamp ?? null
    }));
  },

  readWebSets: () => readWebArrayItem<WebSetRow>(WEB_SETS_KEY),

  readWebCardsBySetId: (setId) =>
    readWebArrayItem<WebCardRow>(`${WEB_CARDS_KEY_PREFIX}${setId}`),

  readWebInventoryRows: () => readWebArrayItem<WebInventoryRow>(WEB_INVENTORY_KEY),

  readWebCollections: () => readWebArrayItem<WebCollectionRow>(WEB_COLLECTIONS_KEY)
};

// ---------------------------------------------------------------------------
// getCachedNmPrice (used for offline fallback in the UI)
// ---------------------------------------------------------------------------

const WEB_PRICE_CACHE_KEY_PREFIX = "tcg:price:card:";

export async function getCachedNmPrice(
  cardId: string,
  deps: CatalogCardDetailDeps = defaultDeps
): Promise<number | null> {
  if (deps.platformOS !== "web") {
    const { getPriceCache } = await import("@/db/repositories/price-cache-repository");
    const row = await getPriceCache(cardId);
    return row?.currentPriceUsd ?? null;
  }
  if (typeof window === "undefined" || !window.localStorage) return null;
  const raw = window.localStorage.getItem(`${WEB_PRICE_CACHE_KEY_PREFIX}${cardId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { currentPriceUsd?: number };
    return typeof parsed.currentPriceUsd === "number" ? parsed.currentPriceUsd : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// getCatalogCardMetadata
// ---------------------------------------------------------------------------

export async function getCatalogCardMetadata(
  cardId: string,
  deps: CatalogCardDetailDeps = defaultDeps
): Promise<CatalogCardMetadata | null> {
  if (deps.platformOS !== "web") {
    const row = await deps.getCardWithSetById(cardId);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      number: row.number,
      setId: row.setId,
      setName: row.setName,
      imageUrl: row.imageUrl
    };
  }

  // Web: iterate all cached sets and their card lists to find the card by ID
  const sets = deps.readWebSets();
  for (const set of sets) {
    const cards = deps.readWebCardsBySetId(set.id);
    const card = cards.find((c) => c.id === cardId);
    if (card) {
      return {
        id: card.id,
        name: card.name,
        number: card.number,
        setId: card.setId ?? set.id,
        setName: set.name,
        imageUrl: card.imageUrl ?? null
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// getCopiesForCard
// ---------------------------------------------------------------------------

export async function getCopiesForCard(
  cardId: string,
  deps: CatalogCardDetailDeps = defaultDeps
): Promise<MyCardCopiesSummary> {
  let copies: MyCardCopy[];

  if (deps.platformOS !== "web") {
    const rows = await deps.getInventoryCopiesByCardId(cardId);
    copies = rows.map((r) => ({
      inventoryId: r.inventoryId,
      collectionId: r.collectionId,
      collectionName: r.collectionName ?? "Sin colección",
      quantity: r.quantity,
      condition: r.condition,
      priceUsd: r.priceUsd,
      priceTimestamp: r.priceTimestamp
    }));
  } else {
    const inventoryRows = deps.readWebInventoryRows().filter((r) => r.cardId === cardId);
    const collections = deps.readWebCollections();
    const collectionById = new Map(collections.map((c) => [c.id, c.name]));

    copies = inventoryRows.map((r) => {
      const priceTimestamp = r.priceTimestamp
        ? (() => {
            const d = new Date(r.priceTimestamp as string | number);
            return Number.isNaN(d.getTime()) ? null : d;
          })()
        : null;

      return {
        inventoryId: r.id,
        collectionId: r.collectionId,
        collectionName: collectionById.get(r.collectionId) ?? "Sin colección",
        quantity: r.quantity,
        condition: r.condition,
        priceUsd: r.priceUsd ?? null,
        priceTimestamp
      };
    });
  }

  const totalQuantity = copies.reduce((sum, c) => sum + c.quantity, 0);

  return { cardId, copies, totalQuantity };
}
