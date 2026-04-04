import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCardsMock } = vi.hoisted(() => ({
  getCardsMock: vi.fn()
}));

vi.mock("justtcg-js", () => {
  return {
    JustTCG: class {
      v1 = {
        cards: {
          get: getCardsMock
        }
      };
    }
  };
});

import { JustTcgNoMatchError, fetchCardConditionPrices, fetchCardPrice } from "@/services/justtcg-client";

describe("fetchCardPrice", () => {
  beforeEach(() => {
    getCardsMock.mockReset();
  });

  it("fails fast when lookup has no usable filters", async () => {
    await expect(fetchCardPrice({ setId: "base1" })).rejects.toBeInstanceOf(JustTcgNoMatchError);
    expect(getCardsMock).not.toHaveBeenCalled();
  });

  it("fails when only cardId is provided because remote lookup must not use it", async () => {
    await expect(fetchCardPrice({ cardId: "base1-4" })).rejects.toBeInstanceOf(JustTcgNoMatchError);
    expect(getCardsMock).not.toHaveBeenCalled();
  });

  it("chooses the best card match instead of the first API result", async () => {
    getCardsMock.mockResolvedValue({
      data: [
        {
          id: "wrong-card",
          name: "Charizard ex",
          number: "199",
          variants: [
            {
              id: "v-wrong",
              condition: "Near Mint",
              printing: "Normal",
              price: 4249.98
            }
          ]
        },
        {
          id: "target-card",
          name: "Charizard",
          number: "4",
          variants: [
            {
              id: "v-target",
              condition: "Near Mint",
              printing: "Normal",
              price: 12.5
            }
          ]
        }
      ]
    });

    const result = await fetchCardPrice({
      cardId: "base1-4",
      cardName: "Charizard",
      cardNumber: "4"
    });

    expect(result.currentPriceUsd).toBe(12.5);
    expect(getCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "Charizard",
        number: "4",
        condition: ["NM", "LP"]
      })
    );
    expect(getCardsMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        cardId: "base1-4"
      })
    );
  });

  it("uses fuzzy set-name substring matching to disambiguate multiple cards", async () => {
    getCardsMock.mockResolvedValue({
      data: [
        {
          id: "wrong-card",
          name: "Charizard",
          set_name: "Pokemon Base",
          number: "4",
          variants: [
            {
              id: "v-wrong",
              condition: "Near Mint",
              printing: "Normal",
              price: 4249.98
            }
          ]
        },
        {
          id: "target-card",
          name: "Charizard",
          set_name: "Base Set",
          number: "4",
          variants: [
            {
              id: "v-target",
              condition: "Near Mint",
              printing: "Normal",
              price: 12.5
            }
          ]
        }
      ]
    });

    const result = await fetchCardPrice({
      setName: "Base Set 2",
      cardName: "Charizard",
      cardNumber: "4",
      condition: "Lightly Played"
    });

    expect(result.currentPriceUsd).toBe(12.5);
    expect(getCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        condition: ["LP"]
      })
    );
  });

  it("maps app card conditions to JustTCG condition filters", async () => {
    getCardsMock.mockResolvedValue({
      data: [
        {
          id: "target-card",
          name: "Charizard",
          set_name: "Base Set",
          number: "4",
          variants: [
            {
              id: "v-target",
              condition: "Damaged",
              printing: "Normal",
              price: 3.5
            }
          ]
        }
      ]
    });

    await fetchCardPrice({
      setName: "Base Set",
      cardName: "Charizard",
      cardNumber: "4",
      condition: "Damaged"
    });

    expect(getCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        condition: ["DMG"]
      })
    );
  });
});

describe("fetchCardConditionPrices", () => {
  const persistNmPriceMock = vi.fn();

  beforeEach(() => {
    getCardsMock.mockReset();
    persistNmPriceMock.mockReset();
    persistNmPriceMock.mockResolvedValue(undefined);
  });

  const baseCard = {
    id: "base1-4",
    name: "Charizard",
    number: "4",
    set_name: "Base Set",
    variants: [
      { id: "v-nm-normal", condition: "Near Mint", printing: "Normal", price: 12.5 },
      { id: "v-lp-normal", condition: "Lightly Played", printing: "Normal", price: 9.0 },
      { id: "v-mp-normal", condition: "Moderately Played", printing: "Normal", price: 6.5 },
      { id: "v-hp-normal", condition: "Heavily Played", printing: "Normal", price: 4.0 },
      { id: "v-dmg-normal", condition: "Damaged", printing: "Normal", price: 2.0 }
    ]
  };

  it("returns prices for all 5 conditions when all variants are present", async () => {
    getCardsMock.mockResolvedValue({ data: [baseCard] });

    const result = await fetchCardConditionPrices(
      { cardId: "base1-4", cardName: "Charizard", cardNumber: "4" },
      { persistNmPrice: persistNmPriceMock }
    );

    expect(result.source).toBe("remote");
    expect(result.cardId).toBe("base1-4");
    expect(result.prices).toHaveLength(5);
    expect(result.prices.find((p) => p.condition === "Near Mint")?.priceUsd).toBe(12.5);
    expect(result.prices.find((p) => p.condition === "Lightly Played")?.priceUsd).toBe(9.0);
    expect(result.prices.find((p) => p.condition === "Moderately Played")?.priceUsd).toBe(6.5);
    expect(result.prices.find((p) => p.condition === "Heavily Played")?.priceUsd).toBe(4.0);
    expect(result.prices.find((p) => p.condition === "Damaged")?.priceUsd).toBe(2.0);

    expect(getCardsMock).toHaveBeenCalledWith(
      expect.objectContaining({ condition: ["NM", "LP", "MP", "HP", "DMG"] })
    );
  });

  it("returns priceUsd null for a condition with no variants", async () => {
    const cardWithoutDamaged = {
      ...baseCard,
      variants: baseCard.variants.filter((v) => v.condition !== "Damaged")
    };
    getCardsMock.mockResolvedValue({ data: [cardWithoutDamaged] });

    const result = await fetchCardConditionPrices(
      { cardId: "base1-4", cardName: "Charizard", cardNumber: "4" },
      { persistNmPrice: persistNmPriceMock }
    );

    expect(result.prices.find((p) => p.condition === "Damaged")?.priceUsd).toBeNull();
    expect(result.prices.find((p) => p.condition === "Near Mint")?.priceUsd).toBe(12.5);
  });

  it("prefers Normal printing when condition has Normal and Holo variants (RN-05)", async () => {
    const cardWithHolo = {
      ...baseCard,
      variants: [
        { id: "v-nm-holo", condition: "Near Mint", printing: "Holo", price: 55.0 },
        { id: "v-nm-normal", condition: "Near Mint", printing: "Normal", price: 12.5 }
      ]
    };
    getCardsMock.mockResolvedValue({ data: [cardWithHolo] });

    const result = await fetchCardConditionPrices(
      { cardId: "base1-4", cardName: "Charizard", cardNumber: "4" },
      { persistNmPrice: persistNmPriceMock }
    );

    expect(result.prices.find((p) => p.condition === "Near Mint")?.priceUsd).toBe(12.5);
  });

  it("picks highest price when no Normal variant exists for the condition (RN-05)", async () => {
    const cardHoloOnly = {
      ...baseCard,
      variants: [
        { id: "v-nm-holo1", condition: "Near Mint", printing: "Holo", price: 30.0 },
        { id: "v-nm-holo2", condition: "Near Mint", printing: "Reverse Holo", price: 55.0 }
      ]
    };
    getCardsMock.mockResolvedValue({ data: [cardHoloOnly] });

    const result = await fetchCardConditionPrices(
      { cardId: "base1-4", cardName: "Charizard", cardNumber: "4" },
      { persistNmPrice: persistNmPriceMock }
    );

    expect(result.prices.find((p) => p.condition === "Near Mint")?.priceUsd).toBe(55.0);
  });

  it("propagates JustTcgNoMatchError when no card matches", async () => {
    getCardsMock.mockResolvedValue({ data: [] });

    await expect(
      fetchCardConditionPrices(
        { cardName: "Charizard", cardNumber: "4" },
        { persistNmPrice: persistNmPriceMock }
      )
    ).rejects.toBeInstanceOf(JustTcgNoMatchError);
  });

  it("calls persistNmPrice with the NM price when NM is non-null (RN-06)", async () => {
    getCardsMock.mockResolvedValue({ data: [baseCard] });

    await fetchCardConditionPrices(
      { cardId: "base1-4", cardName: "Charizard", cardNumber: "4" },
      { persistNmPrice: persistNmPriceMock }
    );

    expect(persistNmPriceMock).toHaveBeenCalledOnce();
    expect(persistNmPriceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: "base1-4",
        currentPriceUsd: 12.5,
        previousPriceUsd: null
      })
    );
  });

  it("does not call persistNmPrice when NM price is null", async () => {
    const cardNoNm = {
      ...baseCard,
      variants: baseCard.variants.filter((v) => v.condition !== "Near Mint")
    };
    getCardsMock.mockResolvedValue({ data: [cardNoNm] });

    await fetchCardConditionPrices(
      { cardId: "base1-4", cardName: "Charizard", cardNumber: "4" },
      { persistNmPrice: persistNmPriceMock }
    );

    expect(persistNmPriceMock).not.toHaveBeenCalled();
  });

  it("fails fast when neither cardNumber nor cardName is provided", async () => {
    await expect(
      fetchCardConditionPrices({ setId: "base1" }, { persistNmPrice: persistNmPriceMock })
    ).rejects.toBeInstanceOf(JustTcgNoMatchError);
    expect(getCardsMock).not.toHaveBeenCalled();
  });
});
