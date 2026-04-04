import { describe, expect, it, vi } from "vitest";

import { calculatePriceVariationPercent, refreshCardPriceWithVariation } from "@/services/price-variation";

describe("calculatePriceVariationPercent", () => {
  it("returns positive percentage for price increase", () => {
    const variation = calculatePriceVariationPercent(10, 12);
    expect(variation).toBe(20);
  });

  it("returns negative percentage for price decrease", () => {
    const variation = calculatePriceVariationPercent(10, 8);
    expect(variation).toBe(-20);
  });

  it("returns null when previous price is not valid", () => {
    expect(calculatePriceVariationPercent(null, 8)).toBeNull();
    expect(calculatePriceVariationPercent(undefined, 8)).toBeNull();
    expect(calculatePriceVariationPercent(0, 8)).toBeNull();
  });
});

describe("refreshCardPriceWithVariation", () => {
  it("updates inventory snapshot and calculates variation", async () => {
    const syncCardPrice = vi.fn().mockResolvedValue({
      source: "remote",
      price: {
        cardId: "card-1",
        currentPriceUsd: 15,
        previousPriceUsd: 10,
        fetchedAt: new Date("2026-03-21T11:30:00.000Z")
      }
    });

    const result = await refreshCardPriceWithVariation(
      { cardId: "card-1" },
      { syncCardPrice }
    );

    expect(result.variationPercent).toBe(50);
    expect(result.source).toBe("remote");
  });

  it("returns null variation when previous price is missing", async () => {
    const syncCardPrice = vi.fn().mockResolvedValue({
      source: "cache",
      price: {
        cardId: "card-2",
        currentPriceUsd: 7,
        previousPriceUsd: null,
        fetchedAt: new Date("2026-03-21T11:30:00.000Z")
      }
    });

    const result = await refreshCardPriceWithVariation(
      { cardId: "card-2" },
      { syncCardPrice }
    );

    expect(result.variationPercent).toBeNull();
    expect(result.source).toBe("cache");
  });
});