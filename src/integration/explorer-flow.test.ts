import { beforeEach, describe, expect, it } from "vitest";

import { filterCatalogExplorerSets, getCatalogExplorerSets, getCatalogSetCardsWithOwnership } from "@/services/catalog-explorer";

const SETS_KEY = "tcg:catalog:sets:v1";
const CARDS_KEY_PREFIX = "tcg:catalog:cards:set:v2:";
const INVENTORY_KEY = "tcg:inventory:items:v1";

function seedSets() {
  localStorage.setItem(
    SETS_KEY,
    JSON.stringify([
      { id: "base1", name: "Base Set" },
      { id: "neo1", name: "Neo Genesis" }
    ])
  );
}

function seedCards() {
  localStorage.setItem(
    `${CARDS_KEY_PREFIX}base1`,
    JSON.stringify([
      { id: "base1-4", setId: "base1", number: "4", name: "Charizard", imageUrl: null },
      { id: "base1-1", setId: "base1", number: "1", name: "Alakazam", imageUrl: null },
      { id: "base1-10", setId: "base1", number: "10", name: "Caterpie", imageUrl: null }
    ])
  );
  localStorage.setItem(
    `${CARDS_KEY_PREFIX}neo1`,
    JSON.stringify([{ id: "neo1-9", setId: "neo1", number: "9", name: "Lugia", imageUrl: null }])
  );
}

function seedInventory(items: { id: string; cardId: string; quantity: number }[]) {
  const now = new Date().toISOString();
  localStorage.setItem(
    INVENTORY_KEY,
    JSON.stringify(
      items.map((item) => ({
        ...item,
        condition: "Near Mint",
        priceUsd: null,
        addedAt: now
      }))
    )
  );
}

beforeEach(() => {
  localStorage.clear();
  seedSets();
  seedCards();
});

describe("getCatalogExplorerSets", () => {
  it("returns sets with ownership counters of zero when inventory is empty", async () => {
    const sets = await getCatalogExplorerSets();

    expect(sets).toHaveLength(2);
    sets.forEach((set) => {
      expect(set.ownedCardsCount).toBe(0);
      expect(set.ownedQuantity).toBe(0);
    });
  });

  it("counts owned cards and quantity for sets that have inventory", async () => {
    seedInventory([
      { id: "inv-1", cardId: "base1-4", quantity: 2 },
      { id: "inv-2", cardId: "base1-1", quantity: 1 }
    ]);

    const sets = await getCatalogExplorerSets();
    const base1 = sets.find((s) => s.id === "base1");
    const neo1 = sets.find((s) => s.id === "neo1");

    expect(base1?.ownedCardsCount).toBe(2);
    expect(base1?.ownedQuantity).toBe(3);
    expect(neo1?.ownedCardsCount).toBe(0);
    expect(neo1?.ownedQuantity).toBe(0);
  });
});

describe("filterCatalogExplorerSets", () => {
  it("returns all sets when term is empty", async () => {
    const sets = await getCatalogExplorerSets();
    const filtered = filterCatalogExplorerSets(sets, { term: "" });

    expect(filtered).toHaveLength(2);
  });

  it("filters sets by name case-insensitively", async () => {
    const sets = await getCatalogExplorerSets();
    const filtered = filterCatalogExplorerSets(sets, { term: "base" });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("base1");
  });

  it("returns empty array when no set matches the term", async () => {
    const sets = await getCatalogExplorerSets();
    const filtered = filterCatalogExplorerSets(sets, { term: "jungle" });

    expect(filtered).toHaveLength(0);
  });
});

describe("getCatalogSetCardsWithOwnership", () => {
  it("marks cards as unowned when inventory is empty", async () => {
    const cards = await getCatalogSetCardsWithOwnership({ setId: "base1" });

    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((card) => {
      expect(card.isOwned).toBe(false);
      expect(card.ownedQuantity).toBe(0);
      expect(card.inventoryId).toBeNull();
    });
  });

  it("marks owned cards and includes inventoryId", async () => {
    seedInventory([{ id: "inv-4", cardId: "base1-4", quantity: 2 }]);

    const cards = await getCatalogSetCardsWithOwnership({ setId: "base1" });
    const charizard = cards.find((c) => c.id === "base1-4");
    const alakazam = cards.find((c) => c.id === "base1-1");

    expect(charizard?.isOwned).toBe(true);
    expect(charizard?.ownedQuantity).toBe(2);
    expect(charizard?.inventoryId).toBe("inv-4");

    expect(alakazam?.isOwned).toBe(false);
    expect(alakazam?.inventoryId).toBeNull();
  });

  it("returns cards sorted by card number numerically", async () => {
    const cards = await getCatalogSetCardsWithOwnership({ setId: "base1" });
    const numbers = cards.map((c) => c.number);

    expect(numbers).toEqual(["1", "4", "10"]);
  });

  it("filters cards by search term within a set", async () => {
    const results = await getCatalogSetCardsWithOwnership({ setId: "base1", term: "char" });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Charizard");
  });
});
