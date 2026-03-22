import { Platform } from "react-native";

import type { CardCondition } from "@/constants/card-condition";
import { syncCardPriceWithMatching } from "@/services/price-matching";

const WEB_INVENTORY_ITEMS_KEY = "tcg:inventory:items:v1";

type AddCardInput = {
  cardId: string;
  setId: string;
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
  priceUsd?: number | null;
  priceTimestamp?: Date | null;
  addedAt?: Date;
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
  saveInventoryItem: (item: InventoryRowShape) => Promise<void>;
  syncCardPriceWithMatching: typeof syncCardPriceWithMatching;
  readWebInventoryRows: () => WebInventoryRow[];
  writeWebInventoryRows: (rows: WebInventoryRow[]) => void;
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

function writeWebCache(key: string, value: unknown) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function validateInput(input: AddCardInput) {
  if (!input.cardId || !input.setId || !input.name || !input.number) {
    throw new Error("La carta seleccionada no es valida para alta.");
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("La cantidad debe ser un entero mayor que 0.");
  }
}

async function resolvePriceSnapshot(input: AddCardInput, deps: AddCardDeps) {
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
      number: input.number,
      name: input.name
    });

    return {
      source: price.source,
      priceUsd: price.price.currentPriceUsd,
      fetchedAt: new Date()
    };
  } catch {
    return {
      source: "none" as const,
      priceUsd: null,
      fetchedAt: null
    };
  }
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