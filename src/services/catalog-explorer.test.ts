import { describe, expect, it, vi } from "vitest";

import {
  filterCatalogExplorerSets,
  getCatalogExplorerSets,
  getCatalogSetCardsWithOwnership
} from "@/services/catalog-explorer";

describe("getCatalogExplorerSets", () => {
  it("merges catalog sets with inventory ownership summary", async () => {
    const result = await getCatalogExplorerSets({
      getCatalogSetOptions: vi.fn().mockResolvedValue([
        { id: "base1", name: "Base Set" },
        { id: "neo1", name: "Neo Genesis" }
      ]),
      searchCatalogCards: vi.fn(),
      getInventoryOverview: vi.fn().mockResolvedValue({
        items: [
          {
            inventoryId: "inv-1",
            cardId: "card-1",
            name: "Charizard",
            setId: "base1",
            setName: "Base Set",
            number: "4",
            quantity: 2,
            condition: "Near Mint",
            priceUsd: 10,
            currentPriceUsd: 12,
            variationPercent: 20,
            imageUrl: null,
            priceTimestamp: null,
            addedAt: new Date("2026-03-21T10:00:00.000Z")
          },
          {
            inventoryId: "inv-2",
            cardId: "card-2",
            name: "Pichu",
            setId: "neo1",
            setName: "Neo Genesis",
            number: "12",
            quantity: 1,
            condition: "Near Mint",
            priceUsd: 8,
            currentPriceUsd: 8,
            variationPercent: 0,
            imageUrl: null,
            priceTimestamp: null,
            addedAt: new Date("2026-03-21T11:00:00.000Z")
          },
          {
            inventoryId: "inv-3",
            cardId: "card-3",
            name: "Bulbasaur",
            setId: "base1",
            setName: "Base Set",
            number: "44",
            quantity: 3,
            condition: "Lightly Played",
            priceUsd: 3,
            currentPriceUsd: 4,
            variationPercent: 33,
            imageUrl: null,
            priceTimestamp: null,
            addedAt: new Date("2026-03-21T12:00:00.000Z")
          }
        ],
        totalCardsCount: 6,
        totalCollectionValueUsd: 37
      })
    });

    expect(result).toEqual([
      { id: "base1", name: "Base Set", ownedCardsCount: 2, ownedQuantity: 5 },
      { id: "neo1", name: "Neo Genesis", ownedCardsCount: 1, ownedQuantity: 1 }
    ]);
  });
});

describe("filterCatalogExplorerSets", () => {
  it("filters sets by case-insensitive term", () => {
    const result = filterCatalogExplorerSets(
      [
        { id: "base1", name: "Base Set", ownedCardsCount: 2, ownedQuantity: 5 },
        { id: "neo1", name: "Neo Genesis", ownedCardsCount: 1, ownedQuantity: 1 }
      ],
      { term: "neo" }
    );

    expect(result).toEqual([{ id: "neo1", name: "Neo Genesis", ownedCardsCount: 1, ownedQuantity: 1 }]);
  });
});

describe("getCatalogSetCardsWithOwnership", () => {
  it("marks cards already owned in the requested set", async () => {
    const result = await getCatalogSetCardsWithOwnership(
      { setId: "base1", term: "a" },
      {
        getCatalogSetOptions: vi.fn(),
        searchCatalogCards: vi.fn().mockResolvedValue([
          { id: "card-2", setId: "base1", number: "2", name: "Blastoise", imageUrl: null },
          { id: "card-1", setId: "base1", number: "1", name: "Alakazam", imageUrl: null }
        ]),
        getInventoryOverview: vi.fn().mockResolvedValue({
          items: [
            {
              inventoryId: "inv-1",
              cardId: "card-2",
              name: "Blastoise",
              setId: "base1",
              setName: "Base Set",
              number: "2",
              quantity: 4,
              condition: "Near Mint",
              priceUsd: 10,
              currentPriceUsd: 12,
              variationPercent: 20,
              imageUrl: null,
              priceTimestamp: null,
              addedAt: new Date("2026-03-21T10:00:00.000Z")
            },
            {
              inventoryId: "inv-2",
              cardId: "card-9",
              name: "Lugia",
              setId: "neo1",
              setName: "Neo Genesis",
              number: "9",
              quantity: 1,
              condition: "Near Mint",
              priceUsd: 10,
              currentPriceUsd: 12,
              variationPercent: 20,
              imageUrl: null,
              priceTimestamp: null,
              addedAt: new Date("2026-03-21T10:00:00.000Z")
            }
          ],
          totalCardsCount: 5,
          totalCollectionValueUsd: 50
        })
      }
    );

    expect(result).toEqual([
      {
        id: "card-1",
        setId: "base1",
        number: "1",
        name: "Alakazam",
        imageUrl: null,
        isOwned: false,
        ownedQuantity: 0,
        inventoryIds: []
      },
      {
        id: "card-2",
        setId: "base1",
        number: "2",
        name: "Blastoise",
        imageUrl: null,
        isOwned: true,
        ownedQuantity: 4,
        inventoryIds: ["inv-1"]
      }
    ]);
  });

  it("sorts set cards by number instead of alphabetically", async () => {
    const result = await getCatalogSetCardsWithOwnership(
      { setId: "base1" },
      {
        getCatalogSetOptions: vi.fn(),
        searchCatalogCards: vi.fn().mockResolvedValue([
          { id: "card-15", setId: "base1", number: "15", name: "Abra", imageUrl: null },
          { id: "card-2", setId: "base1", number: "2", name: "Zubat", imageUrl: null },
          { id: "card-10", setId: "base1", number: "10", name: "Bulbasaur", imageUrl: null }
        ]),
        getInventoryOverview: vi.fn().mockResolvedValue({
          items: [],
          totalCardsCount: 0,
          totalCollectionValueUsd: 0
        })
      }
    );

    expect(result.map((card) => card.number)).toEqual(["2", "10", "15"]);
  });
});