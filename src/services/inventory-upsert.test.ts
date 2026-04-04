import { describe, expect, it, vi } from "vitest";

import { addCardToInventory } from "@/services/inventory-upsert";

describe("addCardToInventory", () => {
  it("validates quantity > 0", async () => {
    await expect(
      addCardToInventory(
        {
          cardId: "base1-1",
          setId: "base1",
          number: "1",
          name: "Alakazam",
          quantity: 0,
          condition: "Near Mint",
          collectionId: "col-1"
        },
        {
          platformOS: "web",
          getInventoryItemByCardIdCollectionIdAndCondition: vi.fn(),
          getPriceCacheByCardId: vi.fn().mockResolvedValue(null),
          saveInventoryItem: vi.fn(),
          syncCardPriceWithMatching: vi.fn(),
          readWebInventoryRows: vi.fn(),
          writeWebInventoryRows: vi.fn()
        }
      )
    ).rejects.toThrow("La cantidad debe ser un entero mayor que 0.");
  });

  it("creates new row on web when card does not exist", async () => {
    const writeWebInventoryRows = vi.fn();

    const result = await addCardToInventory(
      {
        cardId: "base1-1",
        setId: "base1",
        number: "1",
        name: "Alakazam",
        quantity: 2,
        condition: "Near Mint",
        collectionId: "col-1",
        isOffline: true
      },
      {
        platformOS: "web",
        getInventoryItemByCardIdCollectionIdAndCondition: vi.fn(),
        getPriceCacheByCardId: vi.fn().mockResolvedValue(null),
        saveInventoryItem: vi.fn(),
        syncCardPriceWithMatching: vi.fn(),
        readWebInventoryRows: vi.fn().mockReturnValue([]),
        writeWebInventoryRows
      }
    );

    expect(result.wasMerged).toBe(false);
    expect(result.quantity).toBe(2);
    expect(result.priceSource).toBe("none");
    expect(writeWebInventoryRows).toHaveBeenCalledTimes(1);
  });

  it("merges quantity for duplicate card on web", async () => {
    const writeWebInventoryRows = vi.fn();

    const result = await addCardToInventory(
      {
        cardId: "base1-1",
        setId: "base1",
        number: "1",
        name: "Alakazam",
        quantity: 3,
        condition: "Lightly Played",
        collectionId: "col-1",
        isOffline: true
      },
      {
        platformOS: "web",
        getInventoryItemByCardIdCollectionIdAndCondition: vi.fn(),
        getPriceCacheByCardId: vi.fn().mockResolvedValue(null),
        saveInventoryItem: vi.fn(),
        syncCardPriceWithMatching: vi.fn(),
        readWebInventoryRows: vi.fn().mockReturnValue([
          {
            id: "inv-existing",
            cardId: "base1-1",
            collectionId: "col-1",
            quantity: 2,
            condition: "Lightly Played",
            priceUsd: 10,
            priceTimestamp: "2026-03-21T10:00:00.000Z"
          }
        ]),
        writeWebInventoryRows
      }
    );

    expect(result.wasMerged).toBe(true);
    expect(result.quantity).toBe(5);
    expect(writeWebInventoryRows).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "inv-existing",
          cardId: "base1-1",
          quantity: 5,
          condition: "Lightly Played",
          priceUsd: 10
        })
      ])
    );
  });

  it("stores fetched price when available on native", async () => {
    const saveInventoryItem = vi.fn().mockResolvedValue(undefined);
    const syncCardPriceWithMatching = vi.fn().mockResolvedValue({
      source: "remote",
      lookupUsed: { cardNumber: "1", cardName: "Alakazam", setName: "Base Set", condition: "Near Mint" },
      price: {
        cardId: "base1-1",
        currentPriceUsd: 12.5,
        previousPriceUsd: null,
        fetchedAt: new Date("2026-03-21T10:00:00.000Z")
      }
    });

    const result = await addCardToInventory(
      {
        cardId: "base1-1",
        setId: "base1",
        setName: "Base Set",
        number: "1",
        name: "Alakazam",
        quantity: 1,
        condition: "Near Mint",
        collectionId: "col-1"
      },
      {
        platformOS: "android",
        getInventoryItemByCardIdCollectionIdAndCondition: vi.fn().mockResolvedValue(null),
        getPriceCacheByCardId: vi.fn().mockResolvedValue(null),
        saveInventoryItem,
        syncCardPriceWithMatching,
        readWebInventoryRows: vi.fn(),
        writeWebInventoryRows: vi.fn()
      }
    );

    expect(result.priceSource).toBe("remote");
    expect(syncCardPriceWithMatching).toHaveBeenCalledWith(
      expect.objectContaining({
        setName: "Base Set",
        condition: "Near Mint"
      })
    );
    expect(saveInventoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: "base1-1",
        quantity: 1,
        priceUsd: 12.5
      })
    );
  });

  it("normalizes string price values on native before saving", async () => {
    const saveInventoryItem = vi.fn().mockResolvedValue(undefined);

    await addCardToInventory(
      {
        cardId: "base1-1",
        setId: "base1",
        setName: "Base Set",
        number: "1",
        name: "Alakazam",
        quantity: 1,
        condition: "Near Mint",
        collectionId: "col-1"
      },
      {
        platformOS: "android",
        getInventoryItemByCardIdCollectionIdAndCondition: vi.fn().mockResolvedValue(null),
        getPriceCacheByCardId: vi.fn().mockResolvedValue(null),
        saveInventoryItem,
        syncCardPriceWithMatching: vi.fn().mockResolvedValue({
          source: "remote",
          lookupUsed: { cardNumber: "1", cardName: "Alakazam", setName: "Base Set", condition: "Near Mint" },
          price: {
            cardId: "base1-1",
            currentPriceUsd: "12.5",
            previousPriceUsd: null,
            fetchedAt: new Date("2026-03-21T10:00:00.000Z")
          }
        }),
        readWebInventoryRows: vi.fn(),
        writeWebInventoryRows: vi.fn()
      }
    );

    expect(saveInventoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        priceUsd: 12.5
      })
    );
  });

  it("falls back to cached price on native when sync returns unusable price", async () => {
    const saveInventoryItem = vi.fn().mockResolvedValue(undefined);

    const result = await addCardToInventory(
      {
        cardId: "base1-1",
        setId: "base1",
        setName: "Base Set",
        number: "1",
        name: "Alakazam",
        quantity: 1,
        condition: "Near Mint",
        collectionId: "col-1"
      },
      {
        platformOS: "android",
        getInventoryItemByCardIdCollectionIdAndCondition: vi.fn().mockResolvedValue(null),
        getPriceCacheByCardId: vi.fn().mockResolvedValue({
          currentPriceUsd: "9.75",
          fetchedAt: new Date("2026-03-21T10:00:00.000Z")
        }),
        saveInventoryItem,
        syncCardPriceWithMatching: vi.fn().mockResolvedValue({
          source: "remote",
          lookupUsed: { cardNumber: "1", cardName: "Alakazam", setName: "Base Set", condition: "Near Mint" },
          price: {
            cardId: "base1-1",
            currentPriceUsd: Number.NaN,
            previousPriceUsd: null,
            fetchedAt: new Date("2026-03-21T10:00:00.000Z")
          }
        }),
        readWebInventoryRows: vi.fn(),
        writeWebInventoryRows: vi.fn()
      }
    );

    expect(result.priceSource).toBe("cache");
    expect(saveInventoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        priceUsd: 9.75
      })
    );
  });
});