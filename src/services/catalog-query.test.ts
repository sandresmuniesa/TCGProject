import { describe, expect, it, vi } from "vitest";

import { searchCatalogCards, type CatalogCardSearchResult } from "@/services/catalog-query";

const SAMPLE_CARDS: CatalogCardSearchResult[] = [
  { id: "s1-2", setId: "s1", number: "2", name: "Blastoise", imageUrl: null },
  { id: "s1-1", setId: "s1", number: "1", name: "Alakazam", imageUrl: null },
  { id: "s2-4", setId: "s2", number: "4", name: "Charizard", imageUrl: null }
];

describe("searchCatalogCards", () => {
  it("searches by name and number in web cache", async () => {
    const readWebSetIds = vi.fn().mockReturnValue(["s1", "s2"]);
    const readWebCardsBySetId = vi
      .fn()
      .mockImplementation((setId: string) => SAMPLE_CARDS.filter((card) => card.setId === setId));

    const byName = await searchCatalogCards(
      { term: "char" },
      {
        platformOS: "web",
        searchNativeCards: vi.fn(),
        readWebSetIds,
        readWebCardsBySetId
      }
    );

    const byNumber = await searchCatalogCards(
      { term: "1" },
      {
        platformOS: "web",
        searchNativeCards: vi.fn(),
        readWebSetIds,
        readWebCardsBySetId
      }
    );

    expect(byName.map((card) => card.name)).toEqual(["Charizard"]);
    expect(byNumber.map((card) => card.name)).toEqual(["Alakazam"]);
  });

  it("filters by set and sorts results", async () => {
    const result = await searchCatalogCards(
      { setId: "s1" },
      {
        platformOS: "web",
        searchNativeCards: vi.fn(),
        readWebSetIds: vi.fn().mockReturnValue(["s1", "s2"]),
        readWebCardsBySetId: vi.fn().mockImplementation((setId: string) => SAMPLE_CARDS.filter((card) => card.setId === setId))
      }
    );

    expect(result.map((card) => card.name)).toEqual(["Alakazam", "Blastoise"]);
  });

  it("delegates to native search outside web", async () => {
    const searchNativeCards = vi.fn().mockResolvedValue([SAMPLE_CARDS[0]]);

    const result = await searchCatalogCards(
      { term: "blast" },
      {
        platformOS: "ios",
        searchNativeCards,
        readWebSetIds: vi.fn(),
        readWebCardsBySetId: vi.fn()
      }
    );

    expect(searchNativeCards).toHaveBeenCalledWith({ term: "blast" });
    expect(result).toEqual([SAMPLE_CARDS[0]]);
  });
});