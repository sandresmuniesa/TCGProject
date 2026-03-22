import { Platform } from "react-native";

import type { CardCondition } from "@/constants/card-condition";
import { calculatePriceVariationPercent } from "@/services/price-variation";

const WEB_INVENTORY_ITEMS_KEY = "tcg:inventory:items:v1";
const WEB_SETS_CACHE_KEY = "tcg:catalog:sets:v1";
const WEB_SET_CARDS_CACHE_KEY_PREFIX = "tcg:catalog:cards:set:";
const WEB_PRICE_CACHE_KEY_PREFIX = "tcg:price:card:";

export type InventoryOverviewItem = {
  inventoryId: string;
  cardId: string;
  name: string;
  setId: string;
  setName: string;
  number: string;
  quantity: number;
  condition: CardCondition;
  priceUsd: number | null;
  currentPriceUsd: number | null;
  variationPercent: number | null;
  imageUrl: string | null;
  priceTimestamp: Date | null;
  addedAt: Date;
};

export type InventoryOverview = {
  items: InventoryOverviewItem[];
  totalCardsCount: number;
  totalCollectionValueUsd: number;
};

export type InventoryFilterParams = {
  term?: string;
  setId?: string | null;
};

export type InventorySetFilterOption = {
  setId: string;
  setName: string;
};

type NativeInventoryDetailRow = {
  inventoryId: string;
  cardId: string;
  quantity: number;
  condition: CardCondition;
  priceUsd: number | null;
  priceTimestamp: Date | null;
  addedAt: Date;
  cardName: string | null;
  cardNumber: string | null;
  setId: string | null;
  setName: string | null;
  imageUrl: string | null;
  currentPriceUsd: number | null;
};

type WebInventoryRow = {
  id: string;
  cardId: string;
  quantity: number;
  condition: CardCondition;
  priceUsd?: number | null;
  priceTimestamp?: string | number | Date | null;
  addedAt?: string | number | Date;
};

type WebSetRow = {
  id: string;
  name: string;
};

type WebCardRow = {
  id: string;
  setId: string;
  number: string;
  name: string;
  imageUrl?: string | null;
};

type WebPriceCacheRow = {
  cardId: string;
  currentPriceUsd: number;
};

type InventoryOverviewDeps = {
  platformOS: string;
  getNativeInventoryDetails: () => Promise<NativeInventoryDetailRow[]>;
  readWebInventoryRows: () => WebInventoryRow[];
  readWebSets: () => WebSetRow[];
  readWebCardsBySetId: (setId: string) => WebCardRow[];
  readWebPriceCacheByCardId: (cardId: string) => WebPriceCacheRow | null;
};

function readWebCache<T>(key: string): T | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function readWebArrayCache<T>(key: string): T[] {
  const cached = readWebCache<T[]>(key);
  return Array.isArray(cached) ? cached : [];
}

function normalizeDate(value: string | number | Date | null | undefined, fallback: Date) {
  if (value == null) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function calculateSummary(items: InventoryOverviewItem[]): InventoryOverview {
  const totalCardsCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalCollectionValueUsd = items.reduce((acc, item) => {
    if (item.priceUsd == null || !Number.isFinite(item.priceUsd)) {
      return acc;
    }

    return acc + item.quantity * item.priceUsd;
  }, 0);

  return {
    items,
    totalCardsCount,
    totalCollectionValueUsd
  };
}

export function getInventorySetFilterOptions(items: InventoryOverviewItem[]): InventorySetFilterOption[] {
  const uniqueSets = new Map<string, string>();

  for (const item of items) {
    if (!uniqueSets.has(item.setId)) {
      uniqueSets.set(item.setId, item.setName);
    }
  }

  return Array.from(uniqueSets.entries())
    .map(([setId, setName]) => ({ setId, setName }))
    .sort((a, b) => a.setName.localeCompare(b.setName));
}

export function filterInventoryItems(items: InventoryOverviewItem[], params: InventoryFilterParams) {
  const normalizedTerm = params.term?.trim().toLowerCase() ?? "";
  const setId = params.setId ?? null;

  return items.filter((item) => {
    if (setId && item.setId !== setId) {
      return false;
    }

    if (!normalizedTerm) {
      return true;
    }

    return item.name.toLowerCase().includes(normalizedTerm);
  });
}

function mapNativeRowsToOverview(rows: NativeInventoryDetailRow[]) {
  const items: InventoryOverviewItem[] = rows.map((row) => ({
    inventoryId: row.inventoryId,
    cardId: row.cardId,
    name: row.cardName ?? "Carta sin nombre",
    setId: row.setId ?? "unknown-set",
    setName: row.setName ?? "Set desconocido",
    number: row.cardNumber ?? "-",
    quantity: row.quantity,
    condition: row.condition,
    priceUsd: row.priceUsd ?? null,
    currentPriceUsd: row.currentPriceUsd ?? null,
    variationPercent: calculatePriceVariationPercent(row.priceUsd ?? null, row.currentPriceUsd ?? null),
    imageUrl: row.imageUrl ?? null,
    priceTimestamp: row.priceTimestamp ?? null,
    addedAt: row.addedAt
  }));

  return calculateSummary(items);
}

function mapWebRowsToOverview(deps: InventoryOverviewDeps) {
  const inventoryRows = deps.readWebInventoryRows();
  const setRows = deps.readWebSets();

  if (inventoryRows.length === 0) {
    return {
      items: [],
      totalCardsCount: 0,
      totalCollectionValueUsd: 0
    };
  }

  const setMap = new Map(setRows.map((set) => [set.id, set.name]));
  const cardMap = new Map<string, WebCardRow>();

  for (const set of setRows) {
    const cards = deps.readWebCardsBySetId(set.id);
    for (const card of cards) {
      cardMap.set(card.id, card);
    }
  }

  const now = new Date();
  const items = inventoryRows
    .map((row) => {
      const card = cardMap.get(row.cardId);
      const priceCache = deps.readWebPriceCacheByCardId(row.cardId);
      const priceUsd = row.priceUsd ?? null;
      const currentPriceUsd = priceCache?.currentPriceUsd ?? null;
      const addedAt = normalizeDate(row.addedAt, now);

      return {
        inventoryId: row.id,
        cardId: row.cardId,
        name: card?.name ?? row.cardId,
        setId: card?.setId ?? "unknown-set",
        setName: card?.setId ? (setMap.get(card.setId) ?? "Set desconocido") : "Set desconocido",
        number: card?.number ?? "-",
        quantity: row.quantity,
        condition: row.condition,
        priceUsd,
        currentPriceUsd,
        variationPercent: calculatePriceVariationPercent(priceUsd, currentPriceUsd),
        imageUrl: card?.imageUrl ?? null,
        priceTimestamp: row.priceTimestamp ? normalizeDate(row.priceTimestamp, now) : null,
        addedAt
      } satisfies InventoryOverviewItem;
    })
    .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());

  return calculateSummary(items);
}

const defaultDeps: InventoryOverviewDeps = {
  platformOS: Platform.OS,
  getNativeInventoryDetails: async () => {
    const { getInventoryItemDetails } = await import("@/db/repositories/inventory-repository");
    return (await getInventoryItemDetails()) as NativeInventoryDetailRow[];
  },
  readWebInventoryRows: () => readWebArrayCache<WebInventoryRow>(WEB_INVENTORY_ITEMS_KEY),
  readWebSets: () => readWebArrayCache<WebSetRow>(WEB_SETS_CACHE_KEY),
  readWebCardsBySetId: (setId) => readWebArrayCache<WebCardRow>(`${WEB_SET_CARDS_CACHE_KEY_PREFIX}${setId}`),
  readWebPriceCacheByCardId: (cardId) => readWebCache<WebPriceCacheRow>(`${WEB_PRICE_CACHE_KEY_PREFIX}${cardId}`)
};

export async function getInventoryOverview(deps: InventoryOverviewDeps = defaultDeps): Promise<InventoryOverview> {
  if (deps.platformOS === "web") {
    return mapWebRowsToOverview(deps);
  }

  const nativeRows = await deps.getNativeInventoryDetails();
  return mapNativeRowsToOverview(nativeRows);
}