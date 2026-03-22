import { beforeEach, describe, expect, it, vi } from "vitest";

import { addCardToInventory } from "@/services/inventory-upsert";
import { getInventoryOverview } from "@/services/inventory-query";
import { getInventoryCardDetail, refreshInventoryCardPrice } from "@/services/inventory-detail";

const SETS_KEY = "tcg:catalog:sets:v1";
const CARDS_KEY = "tcg:catalog:cards:set:base1";
const INVENTORY_KEY = "tcg:inventory:items:v1";

function seedCatalog() {
  localStorage.setItem(SETS_KEY, JSON.stringify([{ id: "base1", name: "Base Set" }]));
  localStorage.setItem(
    CARDS_KEY,
    JSON.stringify([{ id: "base1-4", setId: "base1", number: "4", name: "Charizard", imageUrl: null }])
  );
}

beforeEach(() => {
  localStorage.clear();
  seedCatalog();
});

describe("Offline add card: price is not fetched", () => {
  it("stores null price when isOffline is true", async () => {
    const syncCardPriceWithMatching = vi.fn();

    await addCardToInventory(
      { cardId: "base1-4", setId: "base1", number: "4", name: "Charizard", quantity: 1, condition: "Near Mint", isOffline: true },
      {
        platformOS: "web",
        getInventoryItemByCardId: vi.fn().mockResolvedValue(null),
        saveInventoryItem: vi.fn(),
        syncCardPriceWithMatching,
        readWebInventoryRows: () => [],
        writeWebInventoryRows: (rows) => {
          localStorage.setItem(INVENTORY_KEY, JSON.stringify(rows));
        }
      }
    );

    expect(syncCardPriceWithMatching).not.toHaveBeenCalled();

    const overview = await getInventoryOverview();

    expect(overview.items[0].priceUsd).toBeNull();
    expect(overview.items[0].variationPercent).toBeNull();
  });
});

describe("Offline read: inventory and catalog readable without network", () => {
  it("getInventoryOverview reads from localStorage without any network calls", async () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify([
        { id: "inv-1", cardId: "base1-4", quantity: 3, condition: "Near Mint", priceUsd: 20, addedAt: now }
      ])
    );

    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const overview = await getInventoryOverview();

    expect(mockFetch).not.toHaveBeenCalled();
    expect(overview.items).toHaveLength(1);
    expect(overview.items[0].name).toBe("Charizard");
    expect(overview.totalCardsCount).toBe(3);

    vi.unstubAllGlobals();
  });

  it("getInventoryCardDetail reads from localStorage without any network calls", async () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify([{ id: "inv-1", cardId: "base1-4", quantity: 2, condition: "Near Mint", addedAt: now }])
    );

    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const detail = await getInventoryCardDetail("inv-1");

    expect(mockFetch).not.toHaveBeenCalled();
    expect(detail.name).toBe("Charizard");
    expect(detail.quantity).toBe(2);

    vi.unstubAllGlobals();
  });
});

describe("Price refresh flow", () => {
  it("refreshes price and updates inventory snapshot with new price and variation", async () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify([{ id: "inv-1", cardId: "base1-4", quantity: 1, condition: "Near Mint", priceUsd: 10, addedAt: now }])
    );

    const mockRefreshCardPriceWithVariation = vi.fn().mockResolvedValue({
      source: "remote",
      cardId: "base1-4",
      currentPriceUsd: 15,
      previousPriceUsd: 10,
      variationPercent: 50,
      fetchedAt: new Date("2026-03-22T12:00:00.000Z")
    });

    const detail = await refreshInventoryCardPrice("inv-1", {
      platformOS: "web",
      getInventoryOverview,
      refreshCardPriceWithVariation: mockRefreshCardPriceWithVariation,
      saveNativeInventoryItem: vi.fn(),
      deleteNativeInventoryItem: vi.fn(),
      readWebInventoryRows: () => {
        const raw = localStorage.getItem(INVENTORY_KEY);
        return raw ? JSON.parse(raw) : [];
      },
      writeWebInventoryRows: (rows) => {
        localStorage.setItem(INVENTORY_KEY, JSON.stringify(rows));
      }
    });

    expect(mockRefreshCardPriceWithVariation).toHaveBeenCalledTimes(1);
    expect(detail.name).toBe("Charizard");
    expect(detail.priceUsd).toBe(15);
  });

  it("price refresh uses card metadata from inventory detail", async () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      INVENTORY_KEY,
      JSON.stringify([{ id: "inv-1", cardId: "base1-4", quantity: 1, condition: "Near Mint", priceUsd: 8, addedAt: now }])
    );

    const mockRefreshCardPriceWithVariation = vi.fn().mockResolvedValue({
      source: "remote",
      cardId: "base1-4",
      currentPriceUsd: 12,
      previousPriceUsd: 8,
      variationPercent: 50,
      fetchedAt: new Date()
    });

    await refreshInventoryCardPrice("inv-1", {
      platformOS: "web",
      getInventoryOverview,
      refreshCardPriceWithVariation: mockRefreshCardPriceWithVariation,
      saveNativeInventoryItem: vi.fn(),
      deleteNativeInventoryItem: vi.fn(),
      readWebInventoryRows: () => {
        const raw = localStorage.getItem(INVENTORY_KEY);
        return raw ? JSON.parse(raw) : [];
      },
      writeWebInventoryRows: (rows) => {
        localStorage.setItem(INVENTORY_KEY, JSON.stringify(rows));
      }
    });

    const call = mockRefreshCardPriceWithVariation.mock.calls[0][0] as { cardId: string; cardName: string };

    expect(call.cardId).toBe("base1-4");
    expect(call.cardName).toBe("Charizard");
  });
});
