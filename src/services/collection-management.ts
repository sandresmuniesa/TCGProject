import { Platform } from "react-native";

import type { CollectionRow } from "@/db/schema";
import {
  readWebCollections,
  writeWebCollections,
  readWebInventoryRowsV2,
  writeWebInventoryRowsV2,
  getWebCollectionsCount,
  type WebCollectionRow,
  type WebInventoryRowV2
} from "@/services/web-storage";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CollectionSummary = {
  collectionId: string;
  name: string;
  totalCardsCount: number;
  totalUniqueCardsCount: number;
  totalCollectionValueUsd: number;
  createdAt: Date;
};

export type SortBy = "createdAt" | "name" | "totalCardsCount" | "totalCollectionValueUsd";
export type SortDir = "ASC" | "DESC";

// ---------------------------------------------------------------------------
// Internal dep types
// ---------------------------------------------------------------------------

type NativeInventoryMetricsRow = {
  collectionId: string;
  quantity: number;
  priceUsd: number | null;
};

type CollectionManagementDeps = {
  platformOS: string;
  // Native
  getAllCollections: () => Promise<CollectionRow[]>;
  getAllNativeInventoryMetrics: () => Promise<NativeInventoryMetricsRow[]>;
  insertCollection: (row: CollectionRow) => Promise<void>;
  updateCollectionName: (id: string, name: string) => Promise<void>;
  deleteCollectionRecord: (id: string) => Promise<void>;
  getNativeCollectionsCount: () => Promise<number>;
  reassignNativeInventoryItems: (fromCollectionId: string, toCollectionId: string) => Promise<void>;
  // Web
  readWebCollections: typeof readWebCollections;
  writeWebCollections: typeof writeWebCollections;
  readWebInventoryRowsV2: typeof readWebInventoryRowsV2;
  writeWebInventoryRowsV2: typeof writeWebInventoryRowsV2;
  getWebCollectionsCount: typeof getWebCollectionsCount;
};

const defaultDeps: CollectionManagementDeps = {
  platformOS: Platform.OS,
  getAllCollections: async () => {
    const { getAllCollections } = await import("@/db/repositories/collections-repository");
    return getAllCollections();
  },
  getAllNativeInventoryMetrics: async () => {
    const { getInventoryItems } = await import("@/db/repositories/inventory-repository");
    return getInventoryItems();
  },
  insertCollection: async (row) => {
    const { insertCollection } = await import("@/db/repositories/collections-repository");
    return insertCollection(row);
  },
  updateCollectionName: async (id, name) => {
    const { updateCollectionName } = await import("@/db/repositories/collections-repository");
    return updateCollectionName(id, name);
  },
  deleteCollectionRecord: async (id) => {
    const { deleteCollection } = await import("@/db/repositories/collections-repository");
    return deleteCollection(id);
  },
  getNativeCollectionsCount: async () => {
    const { getCollectionsCount } = await import("@/db/repositories/collections-repository");
    return getCollectionsCount();
  },
  reassignNativeInventoryItems: async (fromCollectionId, toCollectionId) => {
    const { reassignInventoryItems } = await import("@/db/repositories/inventory-repository");
    return reassignInventoryItems(fromCollectionId, toCollectionId);
  },
  readWebCollections,
  writeWebCollections,
  readWebInventoryRowsV2,
  writeWebInventoryRowsV2,
  getWebCollectionsCount
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function createCollectionId(): string {
  return `col_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function validateName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("El nombre de la colección no puede estar vacío.");
  }
  if (trimmed.length > 50) {
    throw new Error("El nombre de la colección no puede superar los 50 caracteres.");
  }
}

function checkDuplicateName(
  name: string,
  existingNames: string[],
  excludeId?: string,
  existingCollections?: Array<{ id: string; name: string }>
): void {
  const trimmedLower = name.trim().toLowerCase();
  const duplicateExists = existingCollections
    ? existingCollections.some(
        (c) => c.name.toLowerCase() === trimmedLower && c.id !== excludeId
      )
    : existingNames.some((n) => n.toLowerCase() === trimmedLower);

  if (duplicateExists) {
    throw new Error("Ya existe una colección con ese nombre.");
  }
}

function applySorting(summaries: CollectionSummary[], sortBy: SortBy, sortDir: SortDir): CollectionSummary[] {
  return [...summaries].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "createdAt":
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "totalCardsCount":
        comparison = a.totalCardsCount - b.totalCardsCount;
        break;
      case "totalCollectionValueUsd":
        comparison = a.totalCollectionValueUsd - b.totalCollectionValueUsd;
        break;
    }

    return sortDir === "ASC" ? comparison : -comparison;
  });
}

function buildNativeSummaries(
  collections: CollectionRow[],
  inventoryMetrics: NativeInventoryMetricsRow[]
): CollectionSummary[] {
  const metricsByCollectionId = new Map<
    string,
    { totalCards: number; uniqueCards: number; totalValue: number }
  >();

  for (const item of inventoryMetrics) {
    const acc = metricsByCollectionId.get(item.collectionId) ?? {
      totalCards: 0,
      uniqueCards: 0,
      totalValue: 0
    };
    acc.totalCards += item.quantity;
    acc.uniqueCards += 1;
    acc.totalValue += item.priceUsd != null ? item.quantity * item.priceUsd : 0;
    metricsByCollectionId.set(item.collectionId, acc);
  }

  return collections.map((col) => {
    const metrics = metricsByCollectionId.get(col.id) ?? {
      totalCards: 0,
      uniqueCards: 0,
      totalValue: 0
    };
    return {
      collectionId: col.id,
      name: col.name,
      totalCardsCount: metrics.totalCards,
      totalUniqueCardsCount: metrics.uniqueCards,
      totalCollectionValueUsd: metrics.totalValue,
      createdAt: col.createdAt
    };
  });
}

function buildWebSummaries(
  collections: WebCollectionRow[],
  inventoryRows: WebInventoryRowV2[]
): CollectionSummary[] {
  const metricsByCollectionId = new Map<
    string,
    { totalCards: number; uniqueCards: number; totalValue: number }
  >();

  for (const row of inventoryRows) {
    const acc = metricsByCollectionId.get(row.collectionId) ?? {
      totalCards: 0,
      uniqueCards: 0,
      totalValue: 0
    };
    acc.totalCards += row.quantity;
    acc.uniqueCards += 1;
    const priceUsd = typeof row.priceUsd === "number" ? row.priceUsd : null;
    acc.totalValue += priceUsd != null ? row.quantity * priceUsd : 0;
    metricsByCollectionId.set(row.collectionId, acc);
  }

  return collections.map((col) => {
    const metrics = metricsByCollectionId.get(col.id) ?? {
      totalCards: 0,
      uniqueCards: 0,
      totalValue: 0
    };
    return {
      collectionId: col.id,
      name: col.name,
      totalCardsCount: metrics.totalCards,
      totalUniqueCardsCount: metrics.uniqueCards,
      totalCollectionValueUsd: metrics.totalValue,
      createdAt: new Date(col.createdAt)
    };
  });
}

function reassignWebInventoryItems(
  fromCollectionId: string,
  toCollectionId: string,
  allRows: WebInventoryRowV2[]
): WebInventoryRowV2[] {
  const fromRows = allRows.filter((r) => r.collectionId === fromCollectionId);
  const toRows = allRows.filter((r) => r.collectionId === toCollectionId);
  const otherRows = allRows.filter(
    (r) => r.collectionId !== fromCollectionId && r.collectionId !== toCollectionId
  );

  const toIndex = new Map(toRows.map((r) => [`${r.cardId}::${r.condition}`, r]));

  for (const fromRow of fromRows) {
    const key = `${fromRow.cardId}::${fromRow.condition}`;
    const existing = toIndex.get(key);
    if (existing) {
      existing.quantity = existing.quantity + fromRow.quantity;
    } else {
      toIndex.set(key, { ...fromRow, collectionId: toCollectionId });
    }
  }

  return [...otherRows, ...Array.from(toIndex.values())];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getCollectionsSummary(
  sortBy: SortBy = "createdAt",
  sortDir: SortDir = "ASC",
  deps: CollectionManagementDeps = defaultDeps
): Promise<CollectionSummary[]> {
  if (deps.platformOS === "web") {
    const collections = deps.readWebCollections();
    const inventoryRows = deps.readWebInventoryRowsV2();
    const summaries = buildWebSummaries(collections, inventoryRows);
    return applySorting(summaries, sortBy, sortDir);
  }

  const [collections, inventoryMetrics] = await Promise.all([
    deps.getAllCollections(),
    deps.getAllNativeInventoryMetrics()
  ]);
  const summaries = buildNativeSummaries(collections, inventoryMetrics);
  return applySorting(summaries, sortBy, sortDir);
}

export async function createCollection(
  name: string,
  deps: CollectionManagementDeps = defaultDeps
): Promise<CollectionSummary> {
  const trimmedName = name.trim();
  validateName(trimmedName);

  if (deps.platformOS === "web") {
    const collections = deps.readWebCollections();
    checkDuplicateName(trimmedName, collections.map((c) => c.name));
    const newCollection: WebCollectionRow = {
      id: createCollectionId(),
      name: trimmedName,
      createdAt: Date.now()
    };
    deps.writeWebCollections([...collections, newCollection]);
    return {
      collectionId: newCollection.id,
      name: newCollection.name,
      totalCardsCount: 0,
      totalUniqueCardsCount: 0,
      totalCollectionValueUsd: 0,
      createdAt: new Date(newCollection.createdAt)
    };
  }

  const collections = await deps.getAllCollections();
  checkDuplicateName(trimmedName, [], undefined, collections);
  const newCollection: CollectionRow = {
    id: createCollectionId(),
    name: trimmedName,
    createdAt: new Date()
  };
  await deps.insertCollection(newCollection);
  return {
    collectionId: newCollection.id,
    name: newCollection.name,
    totalCardsCount: 0,
    totalUniqueCardsCount: 0,
    totalCollectionValueUsd: 0,
    createdAt: newCollection.createdAt
  };
}

export async function renameCollection(
  id: string,
  newName: string,
  deps: CollectionManagementDeps = defaultDeps
): Promise<void> {
  const trimmedName = newName.trim();
  validateName(trimmedName);

  if (deps.platformOS === "web") {
    const collections = deps.readWebCollections();
    checkDuplicateName(trimmedName, [], id, collections);
    const updated = collections.map((c) => (c.id === id ? { ...c, name: trimmedName } : c));
    deps.writeWebCollections(updated);
    return;
  }

  const collections = await deps.getAllCollections();
  checkDuplicateName(trimmedName, [], id, collections);
  await deps.updateCollectionName(id, trimmedName);
}

export async function deleteCollection(
  id: string,
  targetCollectionId: string,
  deps: CollectionManagementDeps = defaultDeps
): Promise<void> {
  if (deps.platformOS === "web") {
    const count = deps.getWebCollectionsCount();
    if (count <= 1) {
      throw new Error("No se puede eliminar la única colección existente.");
    }
    const allRows = deps.readWebInventoryRowsV2();
    const reassigned = reassignWebInventoryItems(id, targetCollectionId, allRows);
    deps.writeWebInventoryRowsV2(reassigned);
    const collections = deps.readWebCollections();
    deps.writeWebCollections(collections.filter((c) => c.id !== id));
    return;
  }

  const count = await deps.getNativeCollectionsCount();
  if (count <= 1) {
    throw new Error("No se puede eliminar la única colección existente.");
  }
  await deps.reassignNativeInventoryItems(id, targetCollectionId);
  await deps.deleteCollectionRecord(id);
}

export async function ensureAtLeastOneCollection(
  deps: CollectionManagementDeps = defaultDeps
): Promise<void> {
  if (deps.platformOS === "web") {
    const count = deps.getWebCollectionsCount();
    if (count === 0) {
      await createCollection("Mi colección", deps);
    }
    return;
  }

  const count = await deps.getNativeCollectionsCount();
  if (count === 0) {
    await createCollection("Mi colección", deps);
  }
}
