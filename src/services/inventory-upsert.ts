import { Platform } from "react-native";

import type { CardCondition } from "@/constants/card-condition";
import { syncCardPriceWithMatching } from "@/services/price-matching";

const WEB_INVENTORY_ITEMS_KEY = "tcg:inventory:items:v1";
const WEB_PRICE_CACHE_KEY_PREFIX = "tcg:price:card:";

type AddCardInput = {
  cardId: string;
  setId: string;
  setName?: string;
  number: string;
  name: string;
  quantity: number;
  condition: CardCondition;
  isOffline?: boolean;
};

export type AddCardToInventoryResult = {
  inventoryId: string;
  cardId: string;
  quantity: number;
  wasMerged: boolean;
  priceSource: "remote" | "cache" | "none";
};

type InventoryRowShape = {
  id: string;
  cardId: string;
  quantity: number;
  condition: CardCondition;
  priceUsd: number | null;
  priceTimestamp: Date | null;
  addedAt: Date;
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

type AddCardDeps = {
  platformOS: string;
  getInventoryItemByCardId: (cardId: string) => Promise<InventoryRowShape | null>;
  getPriceCacheByCardId: (cardId: string) => Promise<{ currentPriceUsd: number | string | null; fetchedAt: Date | null } | null>;
  saveInventoryItem: (item: InventoryRowShape) => Promise<void>;
  syncCardPriceWithMatching: typeof syncCardPriceWithMatching;
  readWebInventoryRows: () => WebInventoryRow[];
  writeWebInventoryRows: (rows: WebInventoryRow[]) => void;
};

type ResolvedPriceSnapshot = {
  source: "remote" | "cache" | "none";
  priceUsd: number | null;
  fetchedAt: Date | null;
};

function createInventoryId() {
  return `inv_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function readWebCacheArray<T>(key: string): T[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

function writeWebCache(key: string, value: unknown) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeNullableNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeDate(value: string | number | Date | null | undefined) {
  if (value == null) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateInput(input: AddCardInput) {
  if (!input.cardId || !input.setId || !input.name || !input.number) {
    throw new Error("La carta seleccionada no es valida para alta.");
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("La cantidad debe ser un entero mayor que 0.");
  }
}

async function resolvePriceSnapshot(input: AddCardInput, deps: AddCardDeps): Promise<ResolvedPriceSnapshot> {
  if (input.isOffline) {
    return {
      source: "none" as const,
      priceUsd: null,
      fetchedAt: null
    };
  }

  try {
    const price = await deps.syncCardPriceWithMatching({
      id: input.cardId,
      setId: input.setId,
      setName: input.setName,
      condition: input.condition,
      number: input.number,
      name: input.name
    });

    const priceUsd = normalizeNullableNumber(price.price.currentPriceUsd);

    if (priceUsd != null) {
      return {
        source: price.source,
        priceUsd,
        fetchedAt: normalizeDate(price.price.fetchedAt) ?? new Date()
      };
    }
  } catch {
    // Fall back to the local cache when remote sync is unavailable.
  }

  const cachedPrice = await deps.getPriceCacheByCardId(input.cardId);
  const cachedPriceUsd = normalizeNullableNumber(cachedPrice?.currentPriceUsd);

  if (cachedPriceUsd != null) {
    return {
      source: "cache",
      priceUsd: cachedPriceUsd,
      fetchedAt: normalizeDate(cachedPrice?.fetchedAt)
    };
  }

  return {
    source: "none" as const,
    priceUsd: null,
    fetchedAt: null
  };
}

async function runNativeAdd(input: AddCardInput, deps: AddCardDeps): Promise<AddCardToInventoryResult> {
  const existing = await deps.getInventoryItemByCardId(input.cardId);
  const priceSnapshot = await resolvePriceSnapshot(input, deps);

  const mergedQuantity = (existing?.quantity ?? 0) + input.quantity;
  const savedItem: InventoryRowShape = {
    id: existing?.id ?? createInventoryId(),
    cardId: input.cardId,
    quantity: mergedQuantity,
    condition: input.condition,
    priceUsd: priceSnapshot.priceUsd ?? existing?.priceUsd ?? null,
    priceTimestamp: priceSnapshot.fetchedAt ?? existing?.priceTimestamp ?? null,
    addedAt: existing?.addedAt ?? new Date()
  };

  await deps.saveInventoryItem(savedItem);

  return {
    inventoryId: savedItem.id,
    cardId: input.cardId,
    quantity: mergedQuantity,
    wasMerged: existing != null,
    priceSource: priceSnapshot.source
  };
}

async function runWebAdd(input: AddCardInput, deps: AddCardDeps): Promise<AddCardToInventoryResult> {
  const rows = deps.readWebInventoryRows();
  const existing = rows.find((row) => row.cardId === input.cardId) ?? null;
  const priceSnapshot = await resolvePriceSnapshot(input, deps);
  const mergedQuantity = (existing?.quantity ?? 0) + input.quantity;
  const now = new Date();

  const updatedRow: WebInventoryRow = {
    id: existing?.id ?? createInventoryId(),
    cardId: input.cardId,
    quantity: mergedQuantity,
    condition: input.condition,
    priceUsd: priceSnapshot.priceUsd ?? existing?.priceUsd ?? null,
    priceTimestamp: priceSnapshot.fetchedAt ?? existing?.priceTimestamp ?? null,
    addedAt: existing?.addedAt ?? now
  };

  const filtered = rows.filter((row) => row.cardId !== input.cardId);
  deps.writeWebInventoryRows([updatedRow, ...filtered]);

  return {
    inventoryId: updatedRow.id,
    cardId: input.cardId,
    quantity: mergedQuantity,
    wasMerged: existing != null,
    priceSource: priceSnapshot.source
  };
}

const defaultDeps: AddCardDeps = {
  platformOS: Platform.OS,
  getInventoryItemByCardId: async (cardId) => {
    const { getInventoryItemByCardId } = await import("@/db/repositories/inventory-repository");
    return getInventoryItemByCardId(cardId);
  },
  getPriceCacheByCardId: async (cardId) => {
    if (Platform.OS === "web") {
      const cached = readWebCache<{
        currentPriceUsd?: number | string | null;
        fetchedAt?: string | number | Date | null;
      }>(`${WEB_PRICE_CACHE_KEY_PREFIX}${cardId}`);

      if (!cached) {
        return null;
      }

      return {
        currentPriceUsd: cached.currentPriceUsd ?? null,
        fetchedAt: normalizeDate(cached.fetchedAt)
      };
    }

    const { getPriceCache } = await import("@/db/repositories/price-cache-repository");
    return getPriceCache(cardId);
  },
  saveInventoryItem: async (item) => {
    const { saveInventoryItem } = await import("@/db/repositories/inventory-repository");
    await saveInventoryItem(item);
  },
  syncCardPriceWithMatching,
  readWebInventoryRows: () => readWebCacheArray<WebInventoryRow>(WEB_INVENTORY_ITEMS_KEY),
  writeWebInventoryRows: (rows) => writeWebCache(WEB_INVENTORY_ITEMS_KEY, rows)
};

export async function addCardToInventory(input: AddCardInput, deps: AddCardDeps = defaultDeps): Promise<AddCardToInventoryResult> {
  validateInput(input);

  if (deps.platformOS === "web") {
    return runWebAdd(input, deps);
  }

  return runNativeAdd(input, deps);
}