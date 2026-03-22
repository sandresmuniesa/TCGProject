import { Platform } from "react-native";

import { CARD_CONDITIONS, type CardCondition } from "@/constants/card-condition";
import { getInventoryOverview, type InventoryOverviewItem } from "@/services/inventory-query";
import { refreshCardPriceWithVariation } from "@/services/price-variation";

const WEB_INVENTORY_ITEMS_KEY = "tcg:inventory:items:v1";

export type InventoryCardDetail = InventoryOverviewItem;

type WebInventoryRow = {
  id: string;
  cardId: string;
  quantity: number;
  condition: InventoryOverviewItem["condition"];
  priceUsd?: number | null;
  priceTimestamp?: string | number | Date | null;
  addedAt?: string | number | Date;
};

type InventoryDetailDeps = {
  platformOS: string;
  getInventoryOverview: typeof getInventoryOverview;
  refreshCardPriceWithVariation: typeof refreshCardPriceWithVariation;
  saveNativeInventoryItem: (item: {
    id: string;
    cardId: string;
    quantity: number;
    condition: CardCondition;
    priceUsd: number | null;
    priceTimestamp: Date | null;
    addedAt: Date;
  }) => Promise<void>;
  deleteNativeInventoryItem: (inventoryId: string) => Promise<void>;
  readWebInventoryRows: () => WebInventoryRow[];
  writeWebInventoryRows: (rows: WebInventoryRow[]) => void;
};

export type UpdateInventoryCardInput = {
  inventoryId: string;
  quantity: number;
  condition: CardCondition;
};

export type DeleteInventoryCardInput = {
  inventoryId: string;
};

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

const defaultDeps: InventoryDetailDeps = {
  platformOS: Platform.OS,
  getInventoryOverview,
  refreshCardPriceWithVariation,
  saveNativeInventoryItem: async (item) => {
    const { saveInventoryItem } = await import("@/db/repositories/inventory-repository");
    await saveInventoryItem(item);
  },
  deleteNativeInventoryItem: async (inventoryId) => {
    const { deleteInventoryItem } = await import("@/db/repositories/inventory-repository");
    await deleteInventoryItem(inventoryId);
  },
  readWebInventoryRows: () => readWebCacheArray<WebInventoryRow>(WEB_INVENTORY_ITEMS_KEY),
  writeWebInventoryRows: (rows) => writeWebCache(WEB_INVENTORY_ITEMS_KEY, rows)
};

function validateUpdateInput(input: UpdateInventoryCardInput) {
  if (!input.inventoryId) {
    throw new Error("No se recibio el id de inventario.");
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("La cantidad debe ser un entero mayor que 0.");
  }

  if (!CARD_CONDITIONS.includes(input.condition)) {
    throw new Error("El estado de la carta no es valido.");
  }
}

function updateWebInventoryEntry(input: UpdateInventoryCardInput, deps: InventoryDetailDeps) {
  const rows = deps.readWebInventoryRows();
  const rowExists = rows.some((row) => row.id === input.inventoryId);

  if (!rowExists) {
    throw new Error("No se encontro la carta en inventario.");
  }

  const updatedRows = rows.map((row) => {
    if (row.id !== input.inventoryId) {
      return row;
    }

    return {
      ...row,
      quantity: input.quantity,
      condition: input.condition
    };
  });

  deps.writeWebInventoryRows(updatedRows);
}

function deleteWebInventoryEntry(input: DeleteInventoryCardInput, deps: InventoryDetailDeps) {
  const rows = deps.readWebInventoryRows();
  const updatedRows = rows.filter((row) => row.id !== input.inventoryId);

  if (updatedRows.length === rows.length) {
    throw new Error("No se encontro la carta en inventario.");
  }

  deps.writeWebInventoryRows(updatedRows);
}

export async function getInventoryCardDetail(
  inventoryId: string,
  deps: InventoryDetailDeps = defaultDeps
): Promise<InventoryCardDetail> {
  const overview = await deps.getInventoryOverview();
  const detail = overview.items.find((item) => item.inventoryId === inventoryId);

  if (!detail) {
    throw new Error("No se encontro la carta en inventario.");
  }

  return detail;
}

function updateWebInventorySnapshot(cardId: string, priceUsd: number, priceTimestamp: Date, deps: InventoryDetailDeps) {
  const rows = deps.readWebInventoryRows();
  const updatedRows = rows.map((row) => {
    if (row.cardId !== cardId) {
      return row;
    }

    return {
      ...row,
      priceUsd,
      priceTimestamp
    };
  });

  deps.writeWebInventoryRows(updatedRows);
}

export async function refreshInventoryCardPrice(
  inventoryId: string,
  deps: InventoryDetailDeps = defaultDeps
): Promise<InventoryCardDetail> {
  const detail = await getInventoryCardDetail(inventoryId, deps);

  const refreshed = await deps.refreshCardPriceWithVariation({
    cardId: detail.cardId,
    setId: detail.setId,
    cardNumber: detail.number,
    cardName: detail.name
  });

  if (deps.platformOS === "web") {
    updateWebInventorySnapshot(detail.cardId, refreshed.currentPriceUsd, refreshed.fetchedAt, deps);
  }

  return getInventoryCardDetail(inventoryId, deps);
}

export async function updateInventoryCardEntry(
  input: UpdateInventoryCardInput,
  deps: InventoryDetailDeps = defaultDeps
): Promise<InventoryCardDetail> {
  validateUpdateInput(input);

  const detail = await getInventoryCardDetail(input.inventoryId, deps);

  if (deps.platformOS === "web") {
    updateWebInventoryEntry(input, deps);
  } else {
    await deps.saveNativeInventoryItem({
      id: detail.inventoryId,
      cardId: detail.cardId,
      quantity: input.quantity,
      condition: input.condition,
      priceUsd: detail.priceUsd,
      priceTimestamp: detail.priceTimestamp,
      addedAt: detail.addedAt
    });
  }

  return getInventoryCardDetail(input.inventoryId, deps);
}

export async function deleteInventoryCardEntry(
  input: DeleteInventoryCardInput,
  deps: InventoryDetailDeps = defaultDeps
): Promise<void> {
  if (!input.inventoryId) {
    throw new Error("No se recibio el id de inventario.");
  }

  if (deps.platformOS === "web") {
    deleteWebInventoryEntry(input, deps);
    return;
  }

  await deps.deleteNativeInventoryItem(input.inventoryId);
}