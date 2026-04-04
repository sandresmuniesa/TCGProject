import type { CardCondition } from "@/constants/card-condition";

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

export const WEB_COLLECTIONS_KEY = "tcg:collections:v1";
export const WEB_INVENTORY_ITEMS_V2_KEY = "tcg:inventory:items:v2";
/** Legacy key — kept as a read-only reference for the migration bootstrap. */
export const WEB_INVENTORY_ITEMS_V1_KEY = "tcg:inventory:items:v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WebCollectionRow = {
  id: string;
  name: string;
  /** Epoch milliseconds, as stored in JSON. */
  createdAt: number;
};

export type WebInventoryRowV2 = {
  id: string;
  cardId: string;
  collectionId: string;
  quantity: number;
  condition: CardCondition;
  priceUsd?: number | null;
  priceTimestamp?: string | number | Date | null;
  addedAt?: string | number | Date;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readStorageArray<T>(key: string): T[] {
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

function writeStorageArray(key: string, value: unknown[]): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Collections storage (tcg:collections:v1)
// ---------------------------------------------------------------------------

export function readWebCollections(): WebCollectionRow[] {
  return readStorageArray<WebCollectionRow>(WEB_COLLECTIONS_KEY);
}

export function writeWebCollections(rows: WebCollectionRow[]): void {
  writeStorageArray(WEB_COLLECTIONS_KEY, rows);
}

export function findWebCollectionById(id: string): WebCollectionRow | null {
  const rows = readWebCollections();
  return rows.find((row) => row.id === id) ?? null;
}

export function getWebCollectionsCount(): number {
  return readWebCollections().length;
}

// ---------------------------------------------------------------------------
// Inventory v2 storage (tcg:inventory:items:v2)
// ---------------------------------------------------------------------------

export function readWebInventoryRowsV2(): WebInventoryRowV2[] {
  return readStorageArray<WebInventoryRowV2>(WEB_INVENTORY_ITEMS_V2_KEY);
}

export function writeWebInventoryRowsV2(rows: WebInventoryRowV2[]): void {
  writeStorageArray(WEB_INVENTORY_ITEMS_V2_KEY, rows);
}
