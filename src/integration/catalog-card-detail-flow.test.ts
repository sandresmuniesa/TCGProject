import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock justtcg-js before any imports that use it
const { getCardsMock } = vi.hoisted(() => ({
  getCardsMock: vi.fn()
}));

vi.mock("justtcg-js", () => ({
  JustTCG: class {
    v1 = { cards: { get: getCardsMock } };
  }
}));

import { getCatalogCardMetadata, getCopiesForCard } from "@/services/catalog-card-detail";
import { fetchCardConditionPrices } from "@/services/justtcg-client";
import { addCardToInventory } from "@/services/inventory-upsert";

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

const SETS_KEY = "tcg:catalog:sets:v1";
const CARDS_KEY_PREFIX = "tcg:catalog:cards:set:v2:";
const INVENTORY_KEY = "tcg:inventory:items:v2";
const COLLECTIONS_KEY = "tcg:collections:v1";
const PRICE_CACHE_KEY_PREFIX = "tcg:price:card:";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CHARIZARD = { id: "base1-4", setId: "base1", number: "4", name: "Charizard", imageUrl: "https://img.com/ch.webp" };
const ALAKAZAM  = { id: "base1-1", setId: "base1", number: "1", name: "Alakazam",  imageUrl: null };

function seedCatalog() {
  localStorage.setItem(SETS_KEY, JSON.stringify([{ id: "base1", name: "Base Set" }]));
  localStorage.setItem(`${CARDS_KEY_PREFIX}base1`, JSON.stringify([CHARIZARD, ALAKAZAM]));
}

function seedCollections() {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify([{ id: "col-1", name: "Mi colección" }]));
}

beforeEach(() => {
  localStorage.clear();
  getCardsMock.mockReset();
  seedCatalog();
  seedCollections();
});

// ---------------------------------------------------------------------------
// Flow 1 — CA-02: getCatalogCardMetadata returns card + set info (web)
// ---------------------------------------------------------------------------

describe("Flow 1 — CA-02: catalog card metadata lookup (web)", () => {
  it("returns full metadata for an existing card by iterating cached sets", async () => {
    const result = await getCatalogCardMetadata("base1-4");

    expect(result).toEqual({
      id: "base1-4",
      name: "Charizard",
      number: "4",
      setId: "base1",
      setName: "Base Set",
      imageUrl: "https://img.com/ch.webp"
    });
  });

  it("returns null for a cardId that is not in any cached set", async () => {
    const result = await getCatalogCardMetadata("unknown-999");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Flow 2 — CA-03: fetchCardConditionPrices returns all 5 conditions (web)
// ---------------------------------------------------------------------------

describe("Flow 2 — CA-03: condition prices from JustTCG", () => {
  it("returns all 5 condition prices when JustTCG returns full variants", async () => {
    getCardsMock.mockResolvedValue({
      data: [
        {
          id: "tcg-char",
          name: "Charizard",
          number: "4",
          variants: [
            { id: "v1", condition: "Near Mint",         printing: "Normal", price: 15.00 },
            { id: "v2", condition: "Lightly Played",    printing: "Normal", price: 11.00 },
            { id: "v3", condition: "Moderately Played", printing: "Normal", price:  8.00 },
            { id: "v4", condition: "Heavily Played",    printing: "Normal", price:  5.00 },
            { id: "v5", condition: "Damaged",           printing: "Normal", price:  2.00 }
          ]
        }
      ]
    });

    const result = await fetchCardConditionPrices({
      cardId: "base1-4",
      cardName: "Charizard",
      cardNumber: "4",
      setName: "Base Set"
    });

    expect(result.prices).toHaveLength(5);
    expect(result.source).toBe("remote");

    const nm = result.prices.find((p) => p.condition === "Near Mint");
    expect(nm?.priceUsd).toBe(15.00);

    const lp = result.prices.find((p) => p.condition === "Lightly Played");
    expect(lp?.priceUsd).toBe(11.00);
  });

  it("persists NM price to localStorage price_cache after fetching (CA-10)", async () => {
    getCardsMock.mockResolvedValue({
      data: [
        {
          id: "tcg-char",
          name: "Charizard",
          number: "4",
          variants: [
            { id: "v1", condition: "Near Mint", printing: "Normal", price: 15.00 }
          ]
        }
      ]
    });

    await fetchCardConditionPrices({
      cardId: "base1-4",
      cardName: "Charizard",
      cardNumber: "4",
      setName: "Base Set"
    });

    const cached = JSON.parse(localStorage.getItem(`${PRICE_CACHE_KEY_PREFIX}base1-4`) ?? "null");
    expect(cached).not.toBeNull();
    expect(cached.currentPriceUsd).toBe(15.00);
  });
});

// ---------------------------------------------------------------------------
// Flow 3 — CA-06: getCopiesForCard returns user's copies (web)
// ---------------------------------------------------------------------------

describe("Flow 3 — CA-06: user copies retrieval (web)", () => {
  it("returns an empty summary when user has no copies of the card", async () => {
    const result = await getCopiesForCard("base1-4");

    expect(result.copies).toHaveLength(0);
    expect(result.totalQuantity).toBe(0);
  });

  it("returns all copies with collectionName after card is added to inventory", async () => {
    // Add card offline to avoid JustTCG calls
    await addCardToInventory({
      cardId: "base1-4",
      collectionId: "col-1",
      setId: "base1",
      number: "4",
      name: "Charizard",
      quantity: 2,
      condition: "Near Mint",
      isOffline: true
    });

    const result = await getCopiesForCard("base1-4");

    expect(result.copies).toHaveLength(1);
    expect(result.copies[0].collectionId).toBe("col-1");
    expect(result.copies[0].collectionName).toBe("Mi colección");
    expect(result.copies[0].quantity).toBe(2);
    expect(result.copies[0].condition).toBe("Near Mint");
    expect(result.totalQuantity).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Flow 4 — CA-08: add card to inventory → copies update (web)
// ---------------------------------------------------------------------------

describe("Flow 4 — CA-08: add card keeps copies in sync (web)", () => {
  it("after two adds with different conditions, totalQuantity sums both", async () => {
    await addCardToInventory({
      cardId: "base1-4", collectionId: "col-1", setId: "base1",
      number: "4", name: "Charizard", quantity: 1, condition: "Near Mint", isOffline: true
    });
    await addCardToInventory({
      cardId: "base1-4", collectionId: "col-1", setId: "base1",
      number: "4", name: "Charizard", quantity: 3, condition: "Lightly Played", isOffline: true
    });

    const result = await getCopiesForCard("base1-4");

    expect(result.copies).toHaveLength(2);
    expect(result.totalQuantity).toBe(4);
  });

  it("adding card to different collection creates a separate copy entry", async () => {
    localStorage.setItem(
      COLLECTIONS_KEY,
      JSON.stringify([
        { id: "col-1", name: "Mi colección" },
        { id: "col-2", name: "Colección 2" }
      ])
    );

    await addCardToInventory({
      cardId: "base1-4", collectionId: "col-1", setId: "base1",
      number: "4", name: "Charizard", quantity: 1, condition: "Near Mint", isOffline: true
    });
    await addCardToInventory({
      cardId: "base1-4", collectionId: "col-2", setId: "base1",
      number: "4", name: "Charizard", quantity: 2, condition: "Near Mint", isOffline: true
    });

    const result = await getCopiesForCard("base1-4");

    expect(result.copies).toHaveLength(2);
    const colNames = result.copies.map((c) => c.collectionName);
    expect(colNames).toContain("Mi colección");
    expect(colNames).toContain("Colección 2");
    expect(result.totalQuantity).toBe(3);
  });
});
