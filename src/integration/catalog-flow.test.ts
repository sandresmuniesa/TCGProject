import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syncCardsBySet } from "@/services/catalog-cards-sync";
import { getCatalogSetOptions } from "@/services/catalog-sets-query";
import { searchCatalogCards } from "@/services/catalog-query";
import { syncInitialSets } from "@/services/catalog-sync";

const MOCK_SETS = [
  { id: "base1", name: "Base Set", logo: "https://logo.url", cardCount: { total: 102 } },
  { id: "neo1", name: "Neo Genesis", logo: null, cardCount: { total: 111 } }
];

const MOCK_BASE1_CARDS = {
  cards: [
    { id: "base1-4", localId: "4", name: "Charizard", image: "https://img.url/char.png" },
    { id: "base1-1", localId: "1", name: "Alakazam" }
  ]
};

function mockFetch(url: string) {
  if (url.includes("/sets/base1")) {
    return Promise.resolve({ ok: true, json: async () => MOCK_BASE1_CARDS });
  }

  return Promise.resolve({ ok: true, json: async () => MOCK_SETS });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockImplementation(mockFetch));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Catalog sync → query flow", () => {
  it("syncs sets from remote and makes them available via getCatalogSetOptions", async () => {
    const syncResult = await syncInitialSets();

    expect(syncResult.source).toBe("remote");
    expect(syncResult.count).toBe(2);

    const options = await getCatalogSetOptions();

    expect(options).toHaveLength(2);
    expect(options.map((s) => s.id)).toContain("base1");
    expect(options.map((s) => s.id)).toContain("neo1");
  });

  it("returns from cache on second sync without hitting the network", async () => {
    await syncInitialSets();

    const remoteFetch = vi.fn();
    vi.stubGlobal("fetch", remoteFetch);

    const result = await syncInitialSets();

    expect(result.source).toBe("cache");
    expect(remoteFetch).not.toHaveBeenCalled();
  });

  it("syncs cards for a set and allows searching by name", async () => {
    await syncInitialSets();
    await syncCardsBySet("base1");

    const results = await searchCatalogCards({ term: "charizard" });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Charizard");
    expect(results[0].id).toBe("base1-4");
  });

  it("search is case-insensitive and matches partial names", async () => {
    await syncInitialSets();
    await syncCardsBySet("base1");

    const results = await searchCatalogCards({ term: "ALAKA" });

    expect(results.map((c) => c.name)).toContain("Alakazam");
  });

  it("returns empty results when search term matches nothing", async () => {
    await syncInitialSets();
    await syncCardsBySet("base1");

    const results = await searchCatalogCards({ term: "mewtwo" });

    expect(results).toHaveLength(0);
  });

  it("filters cards by set when setId is provided", async () => {
    await syncInitialSets();
    await syncCardsBySet("base1");

    const allResults = await searchCatalogCards({});
    const filteredResults = await searchCatalogCards({ setId: "neo1" });

    expect(allResults.length).toBeGreaterThan(filteredResults.length);
    expect(filteredResults).toHaveLength(0);
  });

  it("cards for a set return from cache on second sync", async () => {
    await syncInitialSets();
    await syncCardsBySet("base1");

    const remoteFetch = vi.fn();
    vi.stubGlobal("fetch", remoteFetch);

    const result = await syncCardsBySet("base1");

    expect(result.source).toBe("cache");
    expect(remoteFetch).not.toHaveBeenCalled();
  });
});
