import type { CardCondition } from "@/constants/card-condition";
import {
  WEB_INVENTORY_ITEMS_V1_KEY,
  WEB_INVENTORY_ITEMS_V2_KEY,
  readWebCollections,
  writeWebCollections,
  readWebInventoryRowsV2,
  writeWebInventoryRowsV2,
  type WebCollectionRow,
  type WebInventoryRowV2
} from "@/services/web-storage";

const WEB_MIGRATION_DONE_KEY = "tcg:inventory:migration:done";

function createCollectionId() {
  return `col_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function readV1InventoryRows(): Array<Record<string, unknown>> {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const raw = window.localStorage.getItem(WEB_INVENTORY_ITEMS_V1_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
}

function v2Exists(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  return window.localStorage.getItem(WEB_INVENTORY_ITEMS_V2_KEY) !== null;
}

function writeMigrationMark(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(WEB_MIGRATION_DONE_KEY, "1");
}

export function bootstrapCollections(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  // If v2 already exists, bootstrap has already run — nothing to do.
  if (v2Exists()) {
    return;
  }

  // Step 1: Ensure at least one collection exists.
  let collections = readWebCollections();

  if (collections.length === 0) {
    const initial: WebCollectionRow = {
      id: createCollectionId(),
      name: "Mi colección",
      createdAt: Date.now()
    };

    writeWebCollections([initial]);
    collections = [initial];
  }

  const initialCollectionId = collections[0].id;

  // Step 2: Migrate v1 inventory rows to v2, assigning them to the initial collection.
  const legacyRows = readV1InventoryRows();

  const v2Rows: WebInventoryRowV2[] = legacyRows.map((row) => ({
    id: String(row["id"] ?? ""),
    cardId: String(row["cardId"] ?? ""),
    collectionId: initialCollectionId,
    quantity: typeof row["quantity"] === "number" ? row["quantity"] : 1,
    condition: (row["condition"] as CardCondition | undefined) ?? "Near Mint",
    priceUsd: typeof row["priceUsd"] === "number" ? row["priceUsd"] : null,
    priceTimestamp: (row["priceTimestamp"] as string | null | undefined) ?? null,
    addedAt: (row["addedAt"] as string | undefined) ?? new Date().toISOString()
  }));

  writeWebInventoryRowsV2(v2Rows);
  writeMigrationMark();
}
