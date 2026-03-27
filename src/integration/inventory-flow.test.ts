import { beforeEach, describe, expect, it, vi } from "vitest";

import { addCardToInventory } from "@/services/inventory-upsert";
import { filterInventoryItems, getInventoryOverview, getInventorySetFilterOptions } from "@/services/inventory-query";

const SETS_KEY = "tcg:catalog:sets:v1";
const CARDS_KEY = "tcg:catalog:cards:set:v2:base1";
const INVENTORY_KEY = "tcg:inventory:items:v1";
const PRICE_CACHE_KEY_PREFIX = "tcg:price:card:";

function seedCatalog() {
  localStorage.setItem(SETS_KEY, JSON.stringify([{ id: "base1", name: "Base Set" }, { id: "neo1", name: "Neo Genesis" }]));
  localStorage.setItem(
    CARDS_KEY,
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

describe("Add card to inventory (offline flow)", () => {
  it("creates new inventory entry with null price when offline", async () => {
    const result = await addCardToInventory({
      cardId: "base1-4",
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 1,
      condition: "Near Mint",
      isOffline: true
    });

    expect(result.priceSource).toBe("none");
    expect(result.wasMerged).toBe(false);
    expect(result.quantity).toBe(1);

    const overview = await getInventoryOverview();

    expect(overview.items).toHaveLength(1);
    expect(overview.items[0].name).toBe("Charizard");
    expect(overview.items[0].priceUsd).toBeNull();
    expect(overview.items[0].variationPercent).toBeNull();
  });

  it("merges quantity when adding the same card twice", async () => {
    await addCardToInventory({
      cardId: "base1-4",
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 2,
      condition: "Near Mint",
      isOffline: true
    });

    await addCardToInventory({
      cardId: "base1-4",
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 3,
      condition: "Lightly Played",
      isOffline: true
    });

    const overview = await getInventoryOverview();

    expect(overview.items).toHaveLength(1);
    expect(overview.items[0].quantity).toBe(5);
    expect(overview.totalCardsCount).toBe(5);
  });

  it("keeps different cards as separate inventory entries", async () => {
    await addCardToInventory({
      cardId: "base1-4",
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 1,
      condition: "Near Mint",
      isOffline: true
    });

    await addCardToInventory({
      cardId: "base1-1",
      setId: "base1",
      number: "1",
      name: "Alakazam",
      quantity: 2,
      condition: "Near Mint",
      isOffline: true
    });

    const overview = await getInventoryOverview();

    expect(overview.items).toHaveLength(2);
    expect(overview.totalCardsCount).toBe(3);
  });
});

describe("Add card to inventory (online flow)", () => {
  it("stores price returned by price sync and makes it visible in overview", async () => {
    const syncCardPriceWithMatching = vi.fn().mockResolvedValue({
      source: "remote",
      price: {
        cardId: "base1-4",
        currentPriceUsd: 15,
        previousPriceUsd: null,
        fetchedAt: new Date()
      }
    });

    let webRows: unknown[] = [];

    const result = await addCardToInventory(
      { cardId: "base1-4", setId: "base1", number: "4", name: "Charizard", quantity: 1, condition: "Near Mint" },
      {
        platformOS: "web",
        getInventoryItemByCardId: vi.fn().mockResolvedValue(null),
        saveInventoryItem: vi.fn(),
        syncCardPriceWithMatching,
        readWebInventoryRows: () => webRows as ReturnType<typeof Array.prototype.slice>,
        writeWebInventoryRows: (rows) => {
          webRows = rows;
          localStorage.setItem(INVENTORY_KEY, JSON.stringify(rows));
        }
      }
    );

    expect(result.priceSource).toBe("remote");
    expect(syncCardPriceWithMatching).toHaveBeenCalledTimes(1);

    // Store price cache so getInventoryOverview can read it
    localStorage.setItem(`${PRICE_CACHE_KEY_PREFIX}base1-4`, JSON.stringify({ cardId: "base1-4", currentPriceUsd: 15 }));

    const overview = await getInventoryOverview();

    expect(overview.items[0].priceUsd).toBe(15);
    expect(overview.items[0].currentPriceUsd).toBe(15);
  });
});

describe("Inventory overview calculations", () => {
  it("computes correct total value as sum of quantity × priceUsd", async () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify([
        { id: "inv-1", cardId: "base1-4", quantity: 2, condition: "Near Mint", priceUsd: 10, addedAt: now },
        { id: "inv-2", cardId: "base1-1", quantity: 1, condition: "Near Mint", priceUsd: 5, addedAt: now }
      ])
    );

    const overview = await getInventoryOverview();

    expect(overview.totalCollectionValueUsd).toBe(25);
    expect(overview.totalCardsCount).toBe(3);
  });

  it("excludes items with null price from total collection value", async () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify([
        { id: "inv-1", cardId: "base1-4", quantity: 2, condition: "Near Mint", priceUsd: 10, addedAt: now },
        { id: "inv-2", cardId: "base1-1", quantity: 1, condition: "Near Mint", priceUsd: null, addedAt: now }
      ])
    );

    const overview = await getInventoryOverview();

    expect(overview.totalCollectionValueUsd).toBe(20);
    expect(overview.totalCardsCount).toBe(3);
  });

  it("returns empty overview when inventory is empty", async () => {
    const overview = await getInventoryOverview();

    expect(overview.items).toHaveLength(0);
    expect(overview.totalCardsCount).toBe(0);
    expect(overview.totalCollectionValueUsd).toBe(0);
  });
});

describe("Inventory filter and set options", () => {
  it("getInventorySetFilterOptions extracts unique sets from items", async () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify([
        { id: "inv-1", cardId: "base1-4", quantity: 1, condition: "Near Mint", addedAt: now },
        { id: "inv-2", cardId: "base1-1", quantity: 1, condition: "Near Mint", addedAt: now }
      ])
    );

    const overview = await getInventoryOverview();
    const setOptions = getInventorySetFilterOptions(overview.items);

    expect(setOptions).toHaveLength(1);
    expect(setOptions[0].setId).toBe("base1");
    expect(setOptions[0].setName).toBe("Base Set");
  });

  it("filterInventoryItems filters by card name case-insensitively", async () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify([
        { id: "inv-1", cardId: "base1-4", quantity: 1, condition: "Near Mint", addedAt: now },
        { id: "inv-2", cardId: "base1-1", quantity: 1, condition: "Near Mint", addedAt: now }
      ])
    );

    const overview = await getInventoryOverview();
    const filtered = filterInventoryItems(overview.items, { term: "CHAR" });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Charizard");
  });

  it("filterInventoryItems filters by set id", async () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify([
        { id: "inv-1", cardId: "base1-4", quantity: 1, condition: "Near Mint", addedAt: now }
      ])
    );

    const overview = await getInventoryOverview();
    const inSet = filterInventoryItems(overview.items, { setId: "base1" });
    const notInSet = filterInventoryItems(overview.items, { setId: "neo1" });

    expect(inSet).toHaveLength(1);
    expect(notInSet).toHaveLength(0);
  });
});
