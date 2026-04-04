import { Platform } from "react-native";

import { CARD_CONDITIONS, type CardCondition } from "@/constants/card-condition";
import { getInventoryOverview, type InventoryOverviewItem } from "@/services/inventory-query";
import { refreshCardPriceWithVariation } from "@/services/price-variation";
import { WEB_INVENTORY_ITEMS_V2_KEY, type WebInventoryRowV2 } from "@/services/web-storage";

const WEB_INVENTORY_ITEMS_KEY = WEB_INVENTORY_ITEMS_V2_KEY;

export type InventoryCardDetail = InventoryOverviewItem;

type WebInventoryRow = WebInventoryRowV2;

type InventoryDetailDeps = {
  platformOS: string;
  getInventoryOverview: typeof getInventoryOverview;
  refreshCardPriceWithVariation: typeof refreshCardPriceWithVariation;
  saveNativeInventoryItem: (item: {
    id: string;
    cardId: string;
    collectionId: string;
    quantity: number;
    condition: CardCondition;
    priceUsd: number | null;
    priceTimestamp: Date | null;
    addedAt: Date;
  }) => Promise<void>;
  deleteNativeInventoryItem: (inventoryId: string) => Promise<void>;
  updateNativeInventoryPriceSnapshot: (
    inventoryId: string,
    priceUsd: number,
    priceTimestamp: Date
  ) => Promise<void>;
  moveNativeInventoryEntry: (inventoryId: string, targetCollectionId: string) => Promise<void>;
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
  updateNativeInventoryPriceSnapshot: async (inventoryId, priceUsd, priceTimestamp) => {
    const { updateInventoryPriceSnapshot } = await import("@/db/repositories/inventory-repository");
    await updateInventoryPriceSnapshot(inventoryId, priceUsd, priceTimestamp);
  },
  moveNativeInventoryEntry: async (inventoryId, targetCollectionId) => {
    const {
      getInventoryItemById,
      getInventoryItemByCardIdCollectionIdAndCondition,
      saveInventoryItem,
      deleteInventoryItem,
      updateInventoryCollectionId
    } = await import("@/db/repositories/inventory-repository");

    const item = await getInventoryItemById(inventoryId);
    if (!item) {
      throw new Error("No se encontró la entrada de inventario.");
    }

    const collision = await getInventoryItemByCardIdCollectionIdAndCondition(
      item.cardId,
      targetCollectionId,
      item.condition
    );

    if (collision) {
      await saveInventoryItem({ ...collision, quantity: collision.quantity + item.quantity });
      await deleteInventoryItem(inventoryId);
    } else {
      await updateInventoryCollectionId(inventoryId, targetCollectionId);
    }
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

function updateWebInventoryPriceSnapshot(
  inventoryId: string,
  priceUsd: number,
  priceTimestamp: Date,
  deps: InventoryDetailDeps
) {
  const rows = deps.readWebInventoryRows();
  const updatedRows = rows.map((row) => {
    if (row.id !== inventoryId) {
      return row;
    }

    return { ...row, priceUsd, priceTimestamp };
  });

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

export async function refreshInventoryCardPrice(
  inventoryId: string,
  deps: InventoryDetailDeps = defaultDeps
): Promise<InventoryCardDetail> {
  const detail = await getInventoryCardDetail(inventoryId, deps);

  const refreshed = await deps.refreshCardPriceWithVariation({
    cardId: detail.cardId,
    setId: detail.setId,
    setName: detail.setName,
    condition: detail.condition,
    cardNumber: detail.number,
    cardName: detail.name
  });

  if (deps.platformOS === "web") {
    updateWebInventoryPriceSnapshot(inventoryId, refreshed.currentPriceUsd, refreshed.fetchedAt, deps);
  } else {
    await deps.updateNativeInventoryPriceSnapshot(inventoryId, refreshed.currentPriceUsd, refreshed.fetchedAt);
  }

  return getInventoryCardDetail(inventoryId, deps);
}

export async function moveInventoryEntry(
  inventoryId: string,
  targetCollectionId: string,
  deps: InventoryDetailDeps = defaultDeps
): Promise<void> {
  if (deps.platformOS === "web") {
    const rows = deps.readWebInventoryRows();
    const item = rows.find((r) => r.id === inventoryId);

    if (!item) {
      throw new Error("No se encontró la entrada de inventario.");
    }

    const collision = rows.find(
      (r) =>
        r.collectionId === targetCollectionId &&
        r.cardId === item.cardId &&
        r.condition === item.condition &&
        r.id !== inventoryId
    );

    if (collision) {
      const merged = rows.map((r) => {
        if (r.id === collision.id) {
          return { ...r, quantity: r.quantity + item.quantity };
        }
        return r;
      });
      deps.writeWebInventoryRows(merged.filter((r) => r.id !== inventoryId));
    } else {
      deps.writeWebInventoryRows(
        rows.map((r) => (r.id === inventoryId ? { ...r, collectionId: targetCollectionId } : r))
      );
    }

    return;
  }

  await deps.moveNativeInventoryEntry(inventoryId, targetCollectionId);
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
      collectionId: detail.collectionId,
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