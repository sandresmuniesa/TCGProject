import { beforeEach, describe, expect, it } from "vitest";

import { createCollection, deleteCollection, getCollectionsSummary } from "@/services/collection-management";
import { moveInventoryEntry } from "@/services/inventory-detail";
import { getCollectionInventoryOverview } from "@/services/inventory-query";
import { addCardToInventory } from "@/services/inventory-upsert";

const SETS_KEY = "tcg:catalog:sets:v1";
const CARDS_KEY_PREFIX = "tcg:catalog:cards:set:v2:";

function seedCatalog() {
  localStorage.setItem(SETS_KEY, JSON.stringify([{ id: "base1", name: "Base Set" }]));
  localStorage.setItem(
    `${CARDS_KEY_PREFIX}base1`,
    JSON.stringify([
      { id: "base1-4", setId: "base1", number: "4", name: "Charizard", imageUrl: null },
      { id: "base1-1", setId: "base1", number: "1", name: "Alakazam", imageUrl: null }
    ])
  );
}

beforeEach(() => {
  localStorage.clear();
  seedCatalog();
});

describe("Flow 1: Create collection and add a card to it", () => {
  it("added card is visible in the collection overview", async () => {
    const col = await createCollection("Holos");

    await addCardToInventory({
      cardId: "base1-4",
      collectionId: col.collectionId,
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 1,
      condition: "Near Mint",
      isOffline: true
    });

    const overview = await getCollectionInventoryOverview(col.collectionId);

    expect(overview.items).toHaveLength(1);
    expect(overview.items[0].name).toBe("Charizard");
    expect(overview.totalCardsCount).toBe(1);
  });
});

describe("Flow 2: Same card with different condition creates two separate entries", () => {
  it("stores two inventory entries when condition differs", async () => {
    const col = await createCollection("Dobles");

    await addCardToInventory({
      cardId: "base1-4",
      collectionId: col.collectionId,
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 1,
      condition: "Near Mint",
      isOffline: true
    });

    await addCardToInventory({
      cardId: "base1-4",
      collectionId: col.collectionId,
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 2,
      condition: "Lightly Played",
      isOffline: true
    });

    const overview = await getCollectionInventoryOverview(col.collectionId);

    expect(overview.items).toHaveLength(2);
    expect(overview.totalCardsCount).toBe(3);
  });
});

describe("Flow 3: Same card with same condition merges quantity", () => {
  it("results in a single entry with summed quantity", async () => {
    const col = await createCollection("Mergeadas");

    await addCardToInventory({
      cardId: "base1-4",
      collectionId: col.collectionId,
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 2,
      condition: "Near Mint",
      isOffline: true
    });

    const second = await addCardToInventory({
      cardId: "base1-4",
      collectionId: col.collectionId,
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 3,
      condition: "Near Mint",
      isOffline: true
    });

    expect(second.wasMerged).toBe(true);
    expect(second.quantity).toBe(5);

    const overview = await getCollectionInventoryOverview(col.collectionId);

    expect(overview.items).toHaveLength(1);
    expect(overview.items[0].quantity).toBe(5);
    expect(overview.totalCardsCount).toBe(5);
  });
});

describe("Flow 4: Move card to another collection (no collision)", () => {
  it("card disappears from source and appears in target", async () => {
    const col1 = await createCollection("Origen");
    const col2 = await createCollection("Destino");

    const result = await addCardToInventory({
      cardId: "base1-4",
      collectionId: col1.collectionId,
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 2,
      condition: "Near Mint",
      isOffline: true
    });

    await moveInventoryEntry(result.inventoryId, col2.collectionId);

    const source = await getCollectionInventoryOverview(col1.collectionId);
    const target = await getCollectionInventoryOverview(col2.collectionId);

    expect(source.items).toHaveLength(0);
    expect(target.items).toHaveLength(1);
    expect(target.items[0].quantity).toBe(2);
  });
});

describe("Flow 5: Move card to collection where same combination already exists (merge)", () => {
  it("merges quantity into the existing target entry", async () => {
    const col1 = await createCollection("Origen");
    const col2 = await createCollection("Destino");

    const first = await addCardToInventory({
      cardId: "base1-4",
      collectionId: col1.collectionId,
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 3,
      condition: "Near Mint",
      isOffline: true
    });

    await addCardToInventory({
      cardId: "base1-4",
      collectionId: col2.collectionId,
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 2,
      condition: "Near Mint",
      isOffline: true
    });

    await moveInventoryEntry(first.inventoryId, col2.collectionId);

    const source = await getCollectionInventoryOverview(col1.collectionId);
    const target = await getCollectionInventoryOverview(col2.collectionId);

    expect(source.items).toHaveLength(0);
    expect(target.items).toHaveLength(1);
    expect(target.items[0].quantity).toBe(5);
  });
});

describe("Flow 6: Delete empty collection", () => {
  it("removes the collection from the summary", async () => {
    const col1 = await createCollection("Primera");
    const col2 = await createCollection("Segunda");

    await deleteCollection(col2.collectionId, col1.collectionId);

    const summaries = await getCollectionsSummary();

    expect(summaries).toHaveLength(1);
    expect(summaries[0].collectionId).toBe(col1.collectionId);
  });
});

describe("Flow 7: Delete collection with cards — reassignment to target", () => {
  it("cards move to the target collection after deletion", async () => {
    const col1 = await createCollection("Origen");
    const col2 = await createCollection("Destino");

    await addCardToInventory({
      cardId: "base1-4",
      collectionId: col1.collectionId,
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 2,
      condition: "Near Mint",
      isOffline: true
    });

    await deleteCollection(col1.collectionId, col2.collectionId);

    const source = await getCollectionInventoryOverview(col1.collectionId);
    const target = await getCollectionInventoryOverview(col2.collectionId);

    expect(source.items).toHaveLength(0);
    expect(target.items).toHaveLength(1);
    expect(target.items[0].quantity).toBe(2);
    expect(target.items[0].name).toBe("Charizard");
  });
});

describe("Flow 8: Total collection value is computed correctly", () => {
  it("sums quantity × priceUsd for all items in the collection", async () => {
    const col = await createCollection("Valoradas");
    const INVENTORY_KEY = "tcg:inventory:items:v2";
    const COLLECTIONS_KEY = "tcg:collections:v1";

    // Seed inventory directly with prices (since addCardToInventory offline stores null price)
    const now = new Date().toISOString();
    localStorage.setItem(
      COLLECTIONS_KEY,
      JSON.stringify([{ id: col.collectionId, name: col.name, createdAt: col.createdAt.getTime() }])
    );
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify([
        { id: "inv-1", cardId: "base1-4", collectionId: col.collectionId, quantity: 3, condition: "Near Mint", priceUsd: 10, addedAt: now },
        { id: "inv-2", cardId: "base1-1", collectionId: col.collectionId, quantity: 2, condition: "Near Mint", priceUsd: 5, addedAt: now }
      ])
    );

    const overview = await getCollectionInventoryOverview(col.collectionId);

    expect(overview.totalCardsCount).toBe(5);
    expect(overview.totalCollectionValueUsd).toBe(40);
  });
});
