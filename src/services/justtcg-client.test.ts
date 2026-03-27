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

import { JustTcgNoMatchError, fetchCardPrice } from "@/services/justtcg-client";

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
