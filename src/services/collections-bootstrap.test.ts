import { beforeEach, describe, expect, it } from "vitest";

import { bootstrapCollections } from "@/services/collections-bootstrap";

const COLLECTIONS_KEY = "tcg:collections:v1";
const INVENTORY_V1_KEY = "tcg:inventory:items:v1";
const INVENTORY_V2_KEY = "tcg:inventory:items:v2";
const MIGRATION_MARK_KEY = "tcg:inventory:migration:done";

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

beforeEach(() => {
  localStorage.clear();
});

describe("Scenario 1: Fresh install — no data in localStorage", () => {
  it("creates the initial collection and an empty v2 inventory", () => {
    bootstrapCollections();

    const collections = readJson<Array<{ id: string; name: string; createdAt: number }>>(COLLECTIONS_KEY);
    expect(collections).toHaveLength(1);
    expect(collections![0].name).toBe("Mi colección");

    const v2 = readJson<unknown[]>(INVENTORY_V2_KEY);
    expect(v2).toEqual([]);

    expect(localStorage.getItem(MIGRATION_MARK_KEY)).toBe("1");
  });
});

describe("Scenario 2: v1 inventory exists with rows — migrates to v2", () => {
  it("copies v1 rows to v2 assigning the initial collectionId, preserves v1", () => {
    const now = new Date().toISOString();
    const v1Rows = [
      { id: "inv-1", cardId: "base1-4", quantity: 2, condition: "Near Mint", priceUsd: 10, addedAt: now },
      { id: "inv-2", cardId: "base1-1", quantity: 1, condition: "Lightly Played", priceUsd: null, addedAt: now }
    ];
    localStorage.setItem(INVENTORY_V1_KEY, JSON.stringify(v1Rows));

    bootstrapCollections();

    // v1 must remain untouched
    const v1After = readJson<typeof v1Rows>(INVENTORY_V1_KEY);
    expect(v1After).toEqual(v1Rows);

    // v2 must contain migrated rows with collectionId
    const v2 = readJson<Array<{ id: string; cardId: string; collectionId: string; quantity: number }>>(INVENTORY_V2_KEY);
    expect(v2).toHaveLength(2);

    const collections = readJson<Array<{ id: string }>> (COLLECTIONS_KEY);
    const initialCollectionId = collections![0].id;

    expect(v2![0].collectionId).toBe(initialCollectionId);
    expect(v2![1].collectionId).toBe(initialCollectionId);
    expect(v2![0].id).toBe("inv-1");
    expect(v2![1].id).toBe("inv-2");
    expect(v2![0].quantity).toBe(2);
  });

  it("preserves price and condition fields in migrated rows", () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      INVENTORY_V1_KEY,
      JSON.stringify([
        { id: "inv-1", cardId: "base1-4", quantity: 3, condition: "Near Mint", priceUsd: 15, addedAt: now }
      ])
    );

    bootstrapCollections();

    const v2 = readJson<Array<{ condition: string; priceUsd: number | null }>>(INVENTORY_V2_KEY);
    expect(v2![0].condition).toBe("Near Mint");
    expect(v2![0].priceUsd).toBe(15);
  });
});

describe("Scenario 3: Migration already done — v2 exists", () => {
  it("does not modify v2 when it already exists", () => {
    const existingV2 = [
      { id: "inv-1", cardId: "base1-4", collectionId: "col-existing", quantity: 5, condition: "Near Mint", priceUsd: null }
    ];
    localStorage.setItem(INVENTORY_V2_KEY, JSON.stringify(existingV2));

    bootstrapCollections();

    const v2After = readJson<typeof existingV2>(INVENTORY_V2_KEY);
    expect(v2After).toEqual(existingV2);
  });
});

describe("Scenario 4: v2 already exists without v1 inventory", () => {
  it("does not create any new collections or overwrite v2", () => {
    const existingV2: unknown[] = [];
    localStorage.setItem(INVENTORY_V2_KEY, JSON.stringify(existingV2));

    bootstrapCollections();

    expect(localStorage.getItem(COLLECTIONS_KEY)).toBeNull();
    const v2After = readJson<unknown[]>(INVENTORY_V2_KEY);
    expect(v2After).toEqual([]);
  });
});

describe("Scenario 5: v1 inventory is empty — creates empty v2", () => {
  it("writes an empty v2 array and the initial collection", () => {
    localStorage.setItem(INVENTORY_V1_KEY, JSON.stringify([]));

    bootstrapCollections();

    const v2 = readJson<unknown[]>(INVENTORY_V2_KEY);
    expect(v2).toEqual([]);

    const collections = readJson<unknown[]>(COLLECTIONS_KEY);
    expect(collections).toHaveLength(1);
  });
});

describe("Idempotency: calling bootstrapCollections twice", () => {
  it("produces the same state as calling it once", () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      INVENTORY_V1_KEY,
      JSON.stringify([
        { id: "inv-1", cardId: "base1-4", quantity: 2, condition: "Near Mint", priceUsd: 10, addedAt: now }
      ])
    );

    bootstrapCollections();
    const v2After1 = readJson<unknown[]>(INVENTORY_V2_KEY);
    const collectionsAfter1 = readJson<unknown[]>(COLLECTIONS_KEY);

    bootstrapCollections();
    const v2After2 = readJson<unknown[]>(INVENTORY_V2_KEY);
    const collectionsAfter2 = readJson<unknown[]>(COLLECTIONS_KEY);

    expect(v2After2).toEqual(v2After1);
    expect(collectionsAfter2).toEqual(collectionsAfter1);
  });

  it("does not duplicate the default collection on fresh install", () => {
    bootstrapCollections();
    bootstrapCollections();

    const collections = readJson<unknown[]>(COLLECTIONS_KEY);
    expect(collections).toHaveLength(1);
  });
});
