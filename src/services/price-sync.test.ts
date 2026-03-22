import { describe, expect, it, vi } from "vitest";

import type { PriceCacheRow } from "@/db/schema";
import type { RemotePrice } from "@/services/types";
import { PriceSyncError, syncCardPrice } from "@/services/price-sync";

function createCacheRow(overrides: Partial<PriceCacheRow> = {}): PriceCacheRow {
  return {
    cardId: "card-1",
    currentPriceUsd: 4.2,
    previousPriceUsd: 3.8,
    fetchedAt: new Date("2026-03-20T10:00:00.000Z"),
    ...overrides
  };
}

describe("syncCardPrice", () => {
  it("fetches remote price and persists it", async () => {
    const remotePrice: RemotePrice = {
      cardId: "card-1",
      currentPriceUsd: 5.1,
      previousPriceUsd: 4.8,
      fetchedAt: new Date("2026-03-21T10:00:00.000Z")
    };

    const getPriceCache = vi.fn().mockResolvedValue(createCacheRow({ currentPriceUsd: 4.2 }));
    const fetchCardPrice = vi.fn().mockResolvedValue(remotePrice);
    const mapRemotePriceToRow = vi.fn().mockReturnValue(
      createCacheRow({ cardId: "card-1", currentPriceUsd: 5.1, previousPriceUsd: 4.8 })
    );
    const upsertPriceCache = vi.fn().mockResolvedValue(undefined);

    const result = await syncCardPrice(
      { cardId: "card-1" },
      {
        fetchCardPrice,
        mapRemotePriceToRow,
        getPriceCache,
        upsertPriceCache
      }
    );

    expect(result.source).toBe("remote");
    expect(result.price.currentPriceUsd).toBe(5.1);
    expect(result.price.previousPriceUsd).toBe(4.2);
    expect(upsertPriceCache).toHaveBeenCalledTimes(1);
  });

  it("returns cached value when network fails", async () => {
    const cache = createCacheRow({ cardId: "card-2", currentPriceUsd: 9.9, previousPriceUsd: 8.5 });

    const getPriceCache = vi.fn().mockResolvedValue(cache);
    const fetchCardPrice = vi.fn().mockRejectedValue(new Error("network down"));
    const mapRemotePriceToRow = vi.fn();
    const upsertPriceCache = vi.fn();

    const result = await syncCardPrice(
      { cardId: "card-2" },
      {
        fetchCardPrice,
        mapRemotePriceToRow,
        getPriceCache,
        upsertPriceCache
      }
    );

    expect(result).toEqual({ source: "cache", price: cache });
    expect(upsertPriceCache).not.toHaveBeenCalled();
  });

  it("throws PriceSyncError when network fails and cache does not exist", async () => {
    const getPriceCache = vi.fn().mockResolvedValue(null);
    const fetchCardPrice = vi.fn().mockRejectedValue(new Error("network down"));
    const mapRemotePriceToRow = vi.fn();
    const upsertPriceCache = vi.fn();

    await expect(
      syncCardPrice(
        { cardId: "card-missing" },
        {
          fetchCardPrice,
          mapRemotePriceToRow,
          getPriceCache,
          upsertPriceCache
        }
      )
    ).rejects.toBeInstanceOf(PriceSyncError);
  });
});