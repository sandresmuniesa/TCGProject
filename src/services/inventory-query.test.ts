import { describe, expect, it, vi } from "vitest";

import {
  filterInventoryItems,
  getInventoryOverview,
  getInventorySetFilterOptions,
  type InventoryOverviewItem
} from "@/services/inventory-query";

const SAMPLE_ITEMS: InventoryOverviewItem[] = [
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
    name: "Bulbasaur",
    setId: "base1",
    setName: "Base Set",
    number: "44",
    quantity: 1,
    condition: "Lightly Played",
    priceUsd: 3,
    currentPriceUsd: 2.5,
    variationPercent: -16.67,
    imageUrl: null,
    priceTimestamp: null,
    addedAt: new Date("2026-03-21T09:00:00.000Z")
  },
  {
    inventoryId: "inv-3",
    cardId: "card-3",
    name: "Lugia",
    setId: "neo1",
    setName: "Neo Genesis",
    number: "8",
    quantity: 1,
    condition: "Near Mint",
    priceUsd: 18,
    currentPriceUsd: 20,
    variationPercent: 11.11,
    imageUrl: null,
    priceTimestamp: null,
    addedAt: new Date("2026-03-21T11:00:00.000Z")
  }
];

describe("getInventoryOverview", () => {
  it("builds overview from native joined rows", async () => {
    const result = await getInventoryOverview({
      platformOS: "android",
      getNativeInventoryDetails: vi.fn().mockResolvedValue([
        {
          inventoryId: "inv-1",
          cardId: "card-1",
          quantity: 2,
          condition: "Near Mint",
          priceUsd: 10,
          priceTimestamp: new Date("2026-03-21T10:00:00.000Z"),
          addedAt: new Date("2026-03-21T09:00:00.000Z"),
          cardName: "Charizard",
          cardNumber: "4",
          setId: "base1",
          setName: "Base Set",
          imageUrl: "https://img.test/charizard.png",
          currentPriceUsd: 12
        }
      ]),
      readWebInventoryRows: vi.fn(),
      readWebSets: vi.fn(),
      readWebCardsBySetId: vi.fn(),
      readWebPriceCacheByCardId: vi.fn()
    });

    expect(result.totalCardsCount).toBe(2);
    expect(result.totalCollectionValueUsd).toBe(20);
    expect(result.items[0].variationPercent).toBe(20);
    expect(result.items[0].name).toBe("Charizard");
  });

  it("builds overview from web cache and sorts by newest first", async () => {
    const result = await getInventoryOverview({
      platformOS: "web",
      getNativeInventoryDetails: vi.fn(),
      readWebInventoryRows: vi.fn().mockReturnValue([
        {
          id: "inv-1",
          cardId: "card-1",
          quantity: 1,
          condition: "Near Mint",
          priceUsd: 15,
          addedAt: "2026-03-21T09:00:00.000Z"
        },
        {
          id: "inv-2",
          cardId: "card-2",
          quantity: 3,
          condition: "Lightly Played",
          priceUsd: 5,
          addedAt: "2026-03-21T11:00:00.000Z"
        }
      ]),
      readWebSets: vi.fn().mockReturnValue([
        { id: "base1", name: "Base Set" },
        { id: "neo1", name: "Neo Genesis" }
      ]),
      readWebCardsBySetId: vi.fn().mockImplementation((setId: string) => {
        if (setId === "base1") {
          return [
            {
              id: "card-1",
              setId: "base1",
              number: "4",
              name: "Charizard",
              imageUrl: "https://img.test/charizard.png"
            }
          ];
        }

        return [
          {
            id: "card-2",
            setId: "neo1",
            number: "8",
            name: "Lugia",
            imageUrl: "https://img.test/lugia.png"
          }
        ];
      }),
      readWebPriceCacheByCardId: vi.fn().mockImplementation((cardId: string) => {
        if (cardId === "card-1") {
          return { cardId, currentPriceUsd: 12 };
        }

        if (cardId === "card-2") {
          return { cardId, currentPriceUsd: 7 };
        }

        return null;
      })
    });

    expect(result.items.map((item) => item.name)).toEqual(["Lugia", "Charizard"]);
    expect(result.totalCardsCount).toBe(4);
    expect(result.totalCollectionValueUsd).toBe(30);
    expect(result.items[0].variationPercent).toBe(40);
    expect(result.items[1].variationPercent).toBe(-20);
  });

  it("returns empty overview when web inventory has no rows", async () => {
    const result = await getInventoryOverview({
      platformOS: "web",
      getNativeInventoryDetails: vi.fn(),
      readWebInventoryRows: vi.fn().mockReturnValue([]),
      readWebSets: vi.fn(),
      readWebCardsBySetId: vi.fn(),
      readWebPriceCacheByCardId: vi.fn()
    });

    expect(result).toEqual({
      items: [],
      totalCardsCount: 0,
      totalCollectionValueUsd: 0
    });
  });
});

describe("filterInventoryItems", () => {
  it("filters by name term only", () => {
    const filtered = filterInventoryItems(SAMPLE_ITEMS, { term: "char" });
    expect(filtered.map((item) => item.name)).toEqual(["Charizard"]);
  });

  it("filters by set only", () => {
    const filtered = filterInventoryItems(SAMPLE_ITEMS, { setId: "base1" });
    expect(filtered.map((item) => item.name)).toEqual(["Charizard", "Bulbasaur"]);
  });

  it("combines name and set filters", () => {
    const filtered = filterInventoryItems(SAMPLE_ITEMS, { setId: "base1", term: "bulb" });
    expect(filtered.map((item) => item.name)).toEqual(["Bulbasaur"]);
  });
});

describe("getInventorySetFilterOptions", () => {
  it("returns unique sorted set options", () => {
    const options = getInventorySetFilterOptions(SAMPLE_ITEMS);

    expect(options).toEqual([
      { setId: "base1", setName: "Base Set" },
      { setId: "neo1", setName: "Neo Genesis" }
    ]);
  });
});