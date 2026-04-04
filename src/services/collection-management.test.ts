import { describe, expect, it, vi } from "vitest";

import {
  createCollection,
  deleteCollection,
  ensureAtLeastOneCollection,
  getCollectionsSummary,
  renameCollection
} from "@/services/collection-management";

function makeWebDeps(
  collections: Array<{ id: string; name: string; createdAt: number }> = [],
  inventoryRows: Array<{ id: string; cardId: string; collectionId: string; condition: string; quantity: number; priceUsd?: number | null }> = []
) {
  let currentCollections = [...collections];
  let currentInventoryRows = [...inventoryRows];

  return {
    platformOS: "web" as const,
    getAllCollections: vi.fn(),
    getAllNativeInventoryMetrics: vi.fn(),
    insertCollection: vi.fn(),
    updateCollectionName: vi.fn(),
    deleteCollectionRecord: vi.fn(),
    getNativeCollectionsCount: vi.fn(),
    reassignNativeInventoryItems: vi.fn(),
    readWebCollections: vi.fn(() => currentCollections),
    writeWebCollections: vi.fn((rows) => {
      currentCollections = rows;
    }),
    readWebInventoryRowsV2: vi.fn(() => currentInventoryRows),
    writeWebInventoryRowsV2: vi.fn((rows) => {
      currentInventoryRows = rows;
    }),
    getWebCollectionsCount: vi.fn(() => currentCollections.length),
    get _collections() {
      return currentCollections;
    },
    get _inventoryRows() {
      return currentInventoryRows;
    }
  };
}

describe("getCollectionsSummary", () => {
  it("returns empty array when no collections exist", async () => {
    const deps = makeWebDeps();

    const result = await getCollectionsSummary("createdAt", "ASC", deps);

    expect(result).toEqual([]);
  });

  it("returns summary with zero metrics when inventory is empty", async () => {
    const deps = makeWebDeps([{ id: "col-1", name: "Mi colección", createdAt: 1000 }]);

    const result = await getCollectionsSummary("createdAt", "ASC", deps);

    expect(result).toHaveLength(1);
    expect(result[0].collectionId).toBe("col-1");
    expect(result[0].name).toBe("Mi colección");
    expect(result[0].totalCardsCount).toBe(0);
    expect(result[0].totalUniqueCardsCount).toBe(0);
    expect(result[0].totalCollectionValueUsd).toBe(0);
  });

  it("computes metrics from inventory rows for each collection", async () => {
    const deps = makeWebDeps(
      [
        { id: "col-1", name: "Mi colección", createdAt: 1000 },
        { id: "col-2", name: "Segunda", createdAt: 2000 }
      ],
      [
        { id: "inv-1", cardId: "base1-4", collectionId: "col-1", condition: "Near Mint", quantity: 3, priceUsd: 10 },
        { id: "inv-2", cardId: "base1-1", collectionId: "col-1", condition: "Near Mint", quantity: 2, priceUsd: 5 },
        { id: "inv-3", cardId: "neo1-1", collectionId: "col-2", condition: "Near Mint", quantity: 1, priceUsd: 20 }
      ]
    );

    const result = await getCollectionsSummary("createdAt", "ASC", deps);

    const col1 = result.find((c) => c.collectionId === "col-1");
    const col2 = result.find((c) => c.collectionId === "col-2");

    expect(col1?.totalCardsCount).toBe(5);
    expect(col1?.totalUniqueCardsCount).toBe(2);
    expect(col1?.totalCollectionValueUsd).toBe(40);

    expect(col2?.totalCardsCount).toBe(1);
    expect(col2?.totalUniqueCardsCount).toBe(1);
    expect(col2?.totalCollectionValueUsd).toBe(20);
  });

  it("sorts collections by name ascending", async () => {
    const deps = makeWebDeps([
      { id: "col-2", name: "Zeta", createdAt: 1000 },
      { id: "col-1", name: "Alpha", createdAt: 2000 }
    ]);

    const result = await getCollectionsSummary("name", "ASC", deps);

    expect(result[0].name).toBe("Alpha");
    expect(result[1].name).toBe("Zeta");
  });

  it("sorts collections by name descending", async () => {
    const deps = makeWebDeps([
      { id: "col-1", name: "Alpha", createdAt: 1000 },
      { id: "col-2", name: "Zeta", createdAt: 2000 }
    ]);

    const result = await getCollectionsSummary("name", "DESC", deps);

    expect(result[0].name).toBe("Zeta");
    expect(result[1].name).toBe("Alpha");
  });
});

describe("createCollection", () => {
  it("creates a new collection and returns its summary", async () => {
    const deps = makeWebDeps();

    const result = await createCollection("Mis Holos", deps);

    expect(result.name).toBe("Mis Holos");
    expect(result.collectionId).toMatch(/^col_/);
    expect(result.totalCardsCount).toBe(0);
    expect(deps._collections).toHaveLength(1);
    expect(deps._collections[0].name).toBe("Mis Holos");
  });

  it("trims whitespace from collection name", async () => {
    const deps = makeWebDeps();

    const result = await createCollection("  Mis Holos  ", deps);

    expect(result.name).toBe("Mis Holos");
  });

  it("rejects empty name", async () => {
    const deps = makeWebDeps();

    await expect(createCollection("", deps)).rejects.toThrow(
      "El nombre de la colección no puede estar vacío."
    );
  });

  it("rejects name with only whitespace", async () => {
    const deps = makeWebDeps();

    await expect(createCollection("   ", deps)).rejects.toThrow(
      "El nombre de la colección no puede estar vacío."
    );
  });

  it("rejects name longer than 50 characters", async () => {
    const deps = makeWebDeps();
    const longName = "A".repeat(51);

    await expect(createCollection(longName, deps)).rejects.toThrow(
      "El nombre de la colección no puede superar los 50 caracteres."
    );
  });

  it("rejects duplicate name case-insensitively", async () => {
    const deps = makeWebDeps([{ id: "col-1", name: "Mi colección", createdAt: 1000 }]);

    await expect(createCollection("MI COLECCIÓN", deps)).rejects.toThrow(
      "Ya existe una colección con ese nombre."
    );
  });

  it("allows name up to exactly 50 characters", async () => {
    const deps = makeWebDeps();
    const exactName = "A".repeat(50);

    const result = await createCollection(exactName, deps);

    expect(result.name).toBe(exactName);
  });
});

describe("renameCollection", () => {
  it("renames an existing collection", async () => {
    const deps = makeWebDeps([{ id: "col-1", name: "Vieja", createdAt: 1000 }]);

    await renameCollection("col-1", "Nueva", deps);

    expect(deps._collections[0].name).toBe("Nueva");
  });

  it("rejects empty new name", async () => {
    const deps = makeWebDeps([{ id: "col-1", name: "Mi colección", createdAt: 1000 }]);

    await expect(renameCollection("col-1", "", deps)).rejects.toThrow(
      "El nombre de la colección no puede estar vacío."
    );
  });

  it("rejects duplicate name case-insensitively (other collection)", async () => {
    const deps = makeWebDeps([
      { id: "col-1", name: "Primera", createdAt: 1000 },
      { id: "col-2", name: "Segunda", createdAt: 2000 }
    ]);

    await expect(renameCollection("col-1", "SEGUNDA", deps)).rejects.toThrow(
      "Ya existe una colección con ese nombre."
    );
  });

  it("allows renaming to the same name (no duplicate conflict with self)", async () => {
    const deps = makeWebDeps([{ id: "col-1", name: "Mi colección", createdAt: 1000 }]);

    await expect(renameCollection("col-1", "Mi colección", deps)).resolves.toBeUndefined();
  });
});

describe("deleteCollection", () => {
  it("throws when trying to delete the only collection", async () => {
    const deps = makeWebDeps([{ id: "col-1", name: "Única", createdAt: 1000 }]);

    await expect(deleteCollection("col-1", "col-1", deps)).rejects.toThrow(
      "No se puede eliminar la única colección existente."
    );
  });

  it("removes collection and reassigns its inventory items to target", async () => {
    const deps = makeWebDeps(
      [
        { id: "col-1", name: "Origen", createdAt: 1000 },
        { id: "col-2", name: "Destino", createdAt: 2000 }
      ],
      [
        { id: "inv-1", cardId: "base1-4", collectionId: "col-1", condition: "Near Mint", quantity: 2 },
        { id: "inv-2", cardId: "base1-1", collectionId: "col-2", condition: "Near Mint", quantity: 1 }
      ]
    );

    await deleteCollection("col-1", "col-2", deps);

    expect(deps._collections).toHaveLength(1);
    expect(deps._collections[0].id).toBe("col-2");

    const inv = deps._inventoryRows;
    expect(inv.every((r) => r.collectionId === "col-2")).toBe(true);
    const reassigned = inv.find((r) => r.cardId === "base1-4");
    expect(reassigned?.quantity).toBe(2);
  });

  it("merges quantities when reassigned card already exists in target collection", async () => {
    const deps = makeWebDeps(
      [
        { id: "col-1", name: "Origen", createdAt: 1000 },
        { id: "col-2", name: "Destino", createdAt: 2000 }
      ],
      [
        { id: "inv-1", cardId: "base1-4", collectionId: "col-1", condition: "Near Mint", quantity: 3 },
        { id: "inv-2", cardId: "base1-4", collectionId: "col-2", condition: "Near Mint", quantity: 2 }
      ]
    );

    await deleteCollection("col-1", "col-2", deps);

    const inv = deps._inventoryRows;
    const merged = inv.find((r) => r.cardId === "base1-4" && r.collectionId === "col-2");
    expect(merged?.quantity).toBe(5);
  });
});

describe("ensureAtLeastOneCollection", () => {
  it("creates default collection when none exist", async () => {
    const deps = makeWebDeps();

    await ensureAtLeastOneCollection(deps);

    expect(deps._collections).toHaveLength(1);
    expect(deps._collections[0].name).toBe("Mi colección");
  });

  it("does not create a collection when one already exists", async () => {
    const deps = makeWebDeps([{ id: "col-1", name: "Existente", createdAt: 1000 }]);

    await ensureAtLeastOneCollection(deps);

    expect(deps._collections).toHaveLength(1);
    expect(deps._collections[0].name).toBe("Existente");
  });

  it("is idempotent when called twice on empty store", async () => {
    const deps = makeWebDeps();

    await ensureAtLeastOneCollection(deps);
    await ensureAtLeastOneCollection(deps);

    expect(deps._collections).toHaveLength(1);
  });
});
