import { describe, expect, it, vi } from "vitest";

import {
  deleteInventoryCardEntry,
  getInventoryCardDetail,
  refreshInventoryCardPrice,
  updateInventoryCardEntry
} from "@/services/inventory-detail";

const SAMPLE_DETAIL = {
  inventoryId: "inv-1",
  cardId: "base1-1",
  collectionId: "col-1",
  collectionName: "Mi colección",
  name: "Alakazam",
  setId: "base1",
  setName: "Base Set",
  number: "1",
  quantity: 2,
  condition: "Near Mint" as const,
  priceUsd: 10,
  currentPriceUsd: 12,
  variationPercent: 20,
  imageUrl: null,
  priceTimestamp: new Date("2026-03-21T10:00:00.000Z"),
  addedAt: new Date("2026-03-21T09:00:00.000Z")
};

describe("getInventoryCardDetail", () => {
  it("returns detail by inventory id", async () => {
    const result = await getInventoryCardDetail("inv-1", {
      platformOS: "web",
      getInventoryOverview: vi.fn().mockResolvedValue({
        items: [SAMPLE_DETAIL],
        totalCardsCount: 2,
        totalCollectionValueUsd: 20
      }),
      refreshCardPriceWithVariation: vi.fn(),
      saveNativeInventoryItem: vi.fn(),
      deleteNativeInventoryItem: vi.fn(),
      updateNativeInventoryPriceSnapshot: vi.fn(),
      moveNativeInventoryEntry: vi.fn(),
      readWebInventoryRows: vi.fn(),
      writeWebInventoryRows: vi.fn()
    });

    expect(result.name).toBe("Alakazam");
  });

  it("throws when inventory id does not exist", async () => {
    await expect(
      getInventoryCardDetail("missing", {
        platformOS: "web",
        getInventoryOverview: vi.fn().mockResolvedValue({
          items: [SAMPLE_DETAIL],
          totalCardsCount: 2,
          totalCollectionValueUsd: 20
        }),
        refreshCardPriceWithVariation: vi.fn(),
        saveNativeInventoryItem: vi.fn(),
        deleteNativeInventoryItem: vi.fn(),
        updateNativeInventoryPriceSnapshot: vi.fn(),
        moveNativeInventoryEntry: vi.fn(),
        readWebInventoryRows: vi.fn(),
        writeWebInventoryRows: vi.fn()
      })
    ).rejects.toThrow("No se encontro la carta en inventario.");
  });
});

describe("refreshInventoryCardPrice", () => {
  it("refreshes and updates web inventory snapshot", async () => {
    const readWebInventoryRows = vi.fn().mockReturnValue([
      {
        id: "inv-1",
        cardId: "base1-1",
        collectionId: "col-1",
        quantity: 2,
        condition: "Near Mint",
        priceUsd: 10,
        priceTimestamp: "2026-03-21T10:00:00.000Z"
      }
    ]);
    const writeWebInventoryRows = vi.fn();

    const getInventoryOverview = vi
      .fn()
      .mockResolvedValueOnce({
        items: [SAMPLE_DETAIL],
        totalCardsCount: 2,
        totalCollectionValueUsd: 20
      })
      .mockResolvedValueOnce({
        items: [
          {
            ...SAMPLE_DETAIL,
            priceUsd: 14,
            currentPriceUsd: 14,
            variationPercent: 16.67,
            priceTimestamp: new Date("2026-03-21T12:00:00.000Z")
          }
        ],
        totalCardsCount: 2,
        totalCollectionValueUsd: 28
      });

    const refreshCardPriceWithVariation = vi.fn().mockResolvedValue({
      source: "remote",
      cardId: "base1-1",
      currentPriceUsd: 14,
      previousPriceUsd: 12,
      variationPercent: 16.67,
      fetchedAt: new Date("2026-03-21T12:00:00.000Z")
    });

    const result = await refreshInventoryCardPrice("inv-1", {
      platformOS: "web",
      getInventoryOverview,
      refreshCardPriceWithVariation,
      saveNativeInventoryItem: vi.fn(),
      deleteNativeInventoryItem: vi.fn(),
      updateNativeInventoryPriceSnapshot: vi.fn(),
      moveNativeInventoryEntry: vi.fn(),
      readWebInventoryRows,
      writeWebInventoryRows
    });

    expect(refreshCardPriceWithVariation).toHaveBeenCalledWith(
      expect.objectContaining({
        setName: "Base Set",
        condition: "Near Mint"
      })
    );
    expect(writeWebInventoryRows).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          cardId: "base1-1",
          priceUsd: 14
        })
      ])
    );
    expect(result.priceUsd).toBe(14);
  });
});

describe("updateInventoryCardEntry", () => {
  it("updates quantity and condition in web inventory cache", async () => {
    const readWebInventoryRows = vi.fn().mockReturnValue([
      {
        id: "inv-1",
        cardId: "base1-1",
        collectionId: "col-1",
        quantity: 2,
        condition: "Near Mint",
        priceUsd: 10,
        priceTimestamp: "2026-03-21T10:00:00.000Z"
      }
    ]);
    const writeWebInventoryRows = vi.fn();

    const getInventoryOverview = vi
      .fn()
      .mockResolvedValueOnce({
        items: [SAMPLE_DETAIL],
        totalCardsCount: 2,
        totalCollectionValueUsd: 20
      })
      .mockResolvedValueOnce({
        items: [
          {
            ...SAMPLE_DETAIL,
            quantity: 5,
            condition: "Lightly Played"
          }
        ],
        totalCardsCount: 5,
        totalCollectionValueUsd: 50
      });

    const result = await updateInventoryCardEntry(
      {
        inventoryId: "inv-1",
        quantity: 5,
        condition: "Lightly Played"
      },
      {
        platformOS: "web",
        getInventoryOverview,
        refreshCardPriceWithVariation: vi.fn(),
        saveNativeInventoryItem: vi.fn(),
        deleteNativeInventoryItem: vi.fn(),
        updateNativeInventoryPriceSnapshot: vi.fn(),
        moveNativeInventoryEntry: vi.fn(),
        readWebInventoryRows,
        writeWebInventoryRows
      }
    );

    expect(writeWebInventoryRows).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "inv-1",
          quantity: 5,
          condition: "Lightly Played"
        })
      ])
    );
    expect(result.quantity).toBe(5);
    expect(result.condition).toBe("Lightly Played");
  });

  it("rejects invalid quantity values", async () => {
    await expect(
      updateInventoryCardEntry(
        {
          inventoryId: "inv-1",
          quantity: 0,
          condition: "Near Mint"
        },
        {
          platformOS: "web",
          getInventoryOverview: vi.fn(),
          refreshCardPriceWithVariation: vi.fn(),
          saveNativeInventoryItem: vi.fn(),
          deleteNativeInventoryItem: vi.fn(),
          updateNativeInventoryPriceSnapshot: vi.fn(),
          moveNativeInventoryEntry: vi.fn(),
          readWebInventoryRows: vi.fn(),
          writeWebInventoryRows: vi.fn()
        }
      )
    ).rejects.toThrow("La cantidad debe ser un entero mayor que 0.");
  });
});

describe("deleteInventoryCardEntry", () => {
  it("removes inventory row from web cache", async () => {
    const writeWebInventoryRows = vi.fn();

    await deleteInventoryCardEntry(
      { inventoryId: "inv-1" },
      {
        platformOS: "web",
        getInventoryOverview: vi.fn(),
        refreshCardPriceWithVariation: vi.fn(),
        saveNativeInventoryItem: vi.fn(),
        deleteNativeInventoryItem: vi.fn(),
        updateNativeInventoryPriceSnapshot: vi.fn(),
        moveNativeInventoryEntry: vi.fn(),
        readWebInventoryRows: vi.fn().mockReturnValue([
          { id: "inv-1", cardId: "base1-1", collectionId: "col-1", quantity: 1, condition: "Near Mint" },
          { id: "inv-2", cardId: "base1-2", collectionId: "col-1", quantity: 2, condition: "Lightly Played" }
        ]),
        writeWebInventoryRows
      }
    );

    expect(writeWebInventoryRows).toHaveBeenCalledWith([
      { id: "inv-2", cardId: "base1-2", collectionId: "col-1", quantity: 2, condition: "Lightly Played" }
    ]);
  });
});