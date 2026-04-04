import { describe, expect, it, vi } from "vitest";

import { getCatalogCardMetadata, getCopiesForCard } from "@/services/catalog-card-detail";

// ---------------------------------------------------------------------------
// Shared fixtures and helpers
// ---------------------------------------------------------------------------

const noopGetCardWithSetById = vi.fn().mockResolvedValue(null);
const noopGetInventoryCopiesByCardId = vi.fn().mockResolvedValue([]);
const noopReadWebSets = vi.fn().mockReturnValue([]);
const noopReadWebCardsBySetId = vi.fn().mockReturnValue([]);
const noopReadWebInventoryRows = vi.fn().mockReturnValue([]);
const noopReadWebCollections = vi.fn().mockReturnValue([]);

function makeDeps(overrides: Partial<Parameters<typeof getCatalogCardMetadata>[1]> = {}) {
  return {
    platformOS: "native" as string,
    getCardWithSetById: noopGetCardWithSetById,
    getInventoryCopiesByCardId: noopGetInventoryCopiesByCardId,
    readWebSets: noopReadWebSets,
    readWebCardsBySetId: noopReadWebCardsBySetId,
    readWebInventoryRows: noopReadWebInventoryRows,
    readWebCollections: noopReadWebCollections,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// getCatalogCardMetadata — native
// ---------------------------------------------------------------------------

describe("getCatalogCardMetadata — native", () => {
  it("returns metadata from the repository for an existing cardId", async () => {
    const getCardWithSetById = vi.fn().mockResolvedValue({
      id: "base1-4",
      setId: "base1",
      number: "4",
      name: "Charizard",
      imageUrl: "https://example.com/charizard.webp",
      setName: "Base Set"
    });

    const result = await getCatalogCardMetadata("base1-4", makeDeps({ getCardWithSetById }));

    expect(result).toEqual({
      id: "base1-4",
      name: "Charizard",
      number: "4",
      setId: "base1",
      setName: "Base Set",
      imageUrl: "https://example.com/charizard.webp"
    });
    expect(getCardWithSetById).toHaveBeenCalledWith("base1-4");
  });

  it("returns null when the cardId does not exist in the database", async () => {
    const getCardWithSetById = vi.fn().mockResolvedValue(null);

    const result = await getCatalogCardMetadata("unknown-id", makeDeps({ getCardWithSetById }));

    expect(result).toBeNull();
  });

  it("returns null imageUrl when the card has no image", async () => {
    const getCardWithSetById = vi.fn().mockResolvedValue({
      id: "base1-4",
      setId: "base1",
      number: "4",
      name: "Charizard",
      imageUrl: null,
      setName: "Base Set"
    });

    const result = await getCatalogCardMetadata("base1-4", makeDeps({ getCardWithSetById }));

    expect(result?.imageUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCatalogCardMetadata — web
// ---------------------------------------------------------------------------

describe("getCatalogCardMetadata — web", () => {
  it("locates a card by iterating web localStorage sets", async () => {
    const readWebSets = vi.fn().mockReturnValue([
      { id: "neo1", name: "Neo Genesis" },
      { id: "base1", name: "Base Set" }
    ]);
    const readWebCardsBySetId = vi.fn().mockImplementation((setId: string) => {
      if (setId === "base1") {
        return [{ id: "base1-4", setId: "base1", number: "4", name: "Charizard", imageUrl: "https://img.com/ch.webp" }];
      }
      return [];
    });

    const result = await getCatalogCardMetadata(
      "base1-4",
      makeDeps({ platformOS: "web", readWebSets, readWebCardsBySetId })
    );

    expect(result).toEqual({
      id: "base1-4",
      name: "Charizard",
      number: "4",
      setId: "base1",
      setName: "Base Set",
      imageUrl: "https://img.com/ch.webp"
    });
  });

  it("returns null when card is not found in any cached set", async () => {
    const readWebSets = vi.fn().mockReturnValue([{ id: "base1", name: "Base Set" }]);
    const readWebCardsBySetId = vi.fn().mockReturnValue([]);

    const result = await getCatalogCardMetadata(
      "unknown-id",
      makeDeps({ platformOS: "web", readWebSets, readWebCardsBySetId })
    );

    expect(result).toBeNull();
  });

  it("returns null when no sets are cached in localStorage", async () => {
    const result = await getCatalogCardMetadata(
      "base1-4",
      makeDeps({ platformOS: "web", readWebSets: vi.fn().mockReturnValue([]) })
    );

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCopiesForCard — native
// ---------------------------------------------------------------------------

describe("getCopiesForCard — native", () => {
  it("returns all copies across collections with correct totalQuantity", async () => {
    const getInventoryCopiesByCardId = vi.fn().mockResolvedValue([
      { inventoryId: "inv-1", collectionId: "col-1", collectionName: "Mi colección", quantity: 2, condition: "Near Mint", priceUsd: 12.5, priceTimestamp: new Date("2026-03-01") },
      { inventoryId: "inv-2", collectionId: "col-2", collectionName: "Colección 2", quantity: 3, condition: "Lightly Played", priceUsd: null, priceTimestamp: null }
    ]);

    const result = await getCopiesForCard("base1-4", makeDeps({ getInventoryCopiesByCardId }));

    expect(result.cardId).toBe("base1-4");
    expect(result.copies).toHaveLength(2);
    expect(result.totalQuantity).toBe(5);
    expect(result.copies[0]).toEqual({
      inventoryId: "inv-1",
      collectionId: "col-1",
      collectionName: "Mi colección",
      quantity: 2,
      condition: "Near Mint",
      priceUsd: 12.5,
      priceTimestamp: new Date("2026-03-01")
    });
  });

  it("returns empty copies and totalQuantity 0 when the user has no copies", async () => {
    const getInventoryCopiesByCardId = vi.fn().mockResolvedValue([]);

    const result = await getCopiesForCard("base1-4", makeDeps({ getInventoryCopiesByCardId }));

    expect(result.copies).toHaveLength(0);
    expect(result.totalQuantity).toBe(0);
  });

  it("uses 'Sin colección' as fallback when collectionName is null", async () => {
    const getInventoryCopiesByCardId = vi.fn().mockResolvedValue([
      { inventoryId: "inv-1", collectionId: "col-orphan", collectionName: null, quantity: 1, condition: "Near Mint", priceUsd: null, priceTimestamp: null }
    ]);

    const result = await getCopiesForCard("base1-4", makeDeps({ getInventoryCopiesByCardId }));

    expect(result.copies[0].collectionName).toBe("Sin colección");
  });
});

// ---------------------------------------------------------------------------
// getCopiesForCard — web
// ---------------------------------------------------------------------------

describe("getCopiesForCard — web", () => {
  it("returns copies enriched with collectionName from web storage", async () => {
    const readWebInventoryRows = vi.fn().mockReturnValue([
      { id: "inv-1", cardId: "base1-4", collectionId: "col-1", quantity: 2, condition: "Near Mint", priceUsd: 10, priceTimestamp: "2026-03-01T00:00:00.000Z" },
      { id: "inv-2", cardId: "base1-4", collectionId: "col-2", quantity: 1, condition: "Damaged", priceUsd: null, priceTimestamp: null }
    ]);
    const readWebCollections = vi.fn().mockReturnValue([
      { id: "col-1", name: "Mi colección" },
      { id: "col-2", name: "Colección oferta" }
    ]);

    const result = await getCopiesForCard(
      "base1-4",
      makeDeps({ platformOS: "web", readWebInventoryRows, readWebCollections })
    );

    expect(result.copies).toHaveLength(2);
    expect(result.totalQuantity).toBe(3);
    expect(result.copies[0].collectionName).toBe("Mi colección");
    expect(result.copies[1].collectionName).toBe("Colección oferta");
    expect(result.copies[0].priceTimestamp).toBeInstanceOf(Date);
  });

  it("filters out inventory rows for other cards", async () => {
    const readWebInventoryRows = vi.fn().mockReturnValue([
      { id: "inv-1", cardId: "base1-4", collectionId: "col-1", quantity: 1, condition: "Near Mint" },
      { id: "inv-2", cardId: "base1-9", collectionId: "col-1", quantity: 3, condition: "Near Mint" }
    ]);
    const readWebCollections = vi.fn().mockReturnValue([{ id: "col-1", name: "Mi colección" }]);

    const result = await getCopiesForCard(
      "base1-4",
      makeDeps({ platformOS: "web", readWebInventoryRows, readWebCollections })
    );

    expect(result.copies).toHaveLength(1);
    expect(result.copies[0].inventoryId).toBe("inv-1");
    expect(result.totalQuantity).toBe(1);
  });

  it("uses 'Sin colección' fallback when collectionId has no matching collection", async () => {
    const readWebInventoryRows = vi.fn().mockReturnValue([
      { id: "inv-1", cardId: "base1-4", collectionId: "col-orphan", quantity: 1, condition: "Near Mint" }
    ]);
    const readWebCollections = vi.fn().mockReturnValue([]);

    const result = await getCopiesForCard(
      "base1-4",
      makeDeps({ platformOS: "web", readWebInventoryRows, readWebCollections })
    );

    expect(result.copies[0].collectionName).toBe("Sin colección");
  });

  it("returns priceTimestamp null when value is invalid", async () => {
    const readWebInventoryRows = vi.fn().mockReturnValue([
      { id: "inv-1", cardId: "base1-4", collectionId: "col-1", quantity: 1, condition: "Near Mint", priceTimestamp: "not-a-date" }
    ]);
    const readWebCollections = vi.fn().mockReturnValue([{ id: "col-1", name: "Mi colección" }]);

    const result = await getCopiesForCard(
      "base1-4",
      makeDeps({ platformOS: "web", readWebInventoryRows, readWebCollections })
    );

    expect(result.copies[0].priceTimestamp).toBeNull();
  });
});
