import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCardsBySet, fetchSets, mapRemoteCardToRow, mapRemoteSetToRow } from "@/services/tcgdex-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mapRemoteSetToRow", () => {
  it("maps all fields from RemoteSet to SetRow", () => {
    const fetchedAt = new Date("2026-03-21T10:00:00.000Z");
    const row = mapRemoteSetToRow(
      { id: "base1", name: "Base Set", logoUrl: "https://example.com/logo.png", totalCards: 102 },
      fetchedAt
    );

    expect(row).toEqual({
      id: "base1",
      name: "Base Set",
      logoUrl: "https://example.com/logo.png",
      totalCards: 102,
      fetchedAt
    });
  });

  it("uses null for missing logoUrl and 0 for missing totalCards", () => {
    const row = mapRemoteSetToRow({ id: "base1", name: "Base Set", logoUrl: null, totalCards: 0 });

    expect(row.logoUrl).toBeNull();
    expect(row.totalCards).toBe(0);
  });

  it("defaults fetchedAt to current date when not provided", () => {
    const before = Date.now();
    const row = mapRemoteSetToRow({ id: "base1", name: "Base Set", logoUrl: null, totalCards: 0 });

    expect(row.fetchedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(row.fetchedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe("mapRemoteCardToRow", () => {
  it("maps all fields from RemoteCard to CardRow", () => {
    const fetchedAt = new Date("2026-03-21T10:00:00.000Z");
    const row = mapRemoteCardToRow(
      {
        id: "base1-4",
        setId: "base1",
        number: "4",
        name: "Charizard",
        imageUrl: "https://example.com/card.png"
      },
      fetchedAt
    );

    expect(row).toEqual({
      id: "base1-4",
      setId: "base1",
      number: "4",
      name: "Charizard",
      imageUrl: "https://example.com/card.png",
      fetchedAt
    });
  });

  it("uses null for missing imageUrl", () => {
    const row = mapRemoteCardToRow({
      id: "base1-4",
      setId: "base1",
      number: "4",
      name: "Charizard",
      imageUrl: null
    });

    expect(row.imageUrl).toBeNull();
  });

  it("defaults fetchedAt to current date when not provided", () => {
    const before = Date.now();
    const row = mapRemoteCardToRow({ id: "base1-4", setId: "base1", number: "4", name: "Charizard", imageUrl: null });

    expect(row.fetchedAt.getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe("fetchSets", () => {
  it("fetches and maps sets from tcgdex API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "base1", name: "Base Set", logo: "https://logo.url", cardCount: { total: 102 } }]
      })
    );

    const sets = await fetchSets();

    expect(sets).toHaveLength(1);
    expect(sets[0]).toEqual({ id: "base1", name: "Base Set", logoUrl: "https://logo.url", totalCards: 102 });
  });

  it("uses null logoUrl and 0 totalCards when API omits them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "base1", name: "Base Set" }]
      })
    );

    const sets = await fetchSets();

    expect(sets[0].logoUrl).toBeNull();
    expect(sets[0].totalCards).toBe(0);
  });

  it("throws when API returns non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(fetchSets()).rejects.toThrow("tcgdex request failed with status 500");
  });
});

describe("fetchCardsBySet", () => {
  it("fetches and maps cards for a set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          cards: [
            { id: "base1-4", localId: "4", name: "Charizard", image: "https://img.url" },
            { id: "base1-1", localId: "1", name: "Alakazam" }
          ]
        })
      })
    );

    const cards = await fetchCardsBySet("base1");

    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({ id: "base1-4", setId: "base1", number: "4", name: "Charizard", imageUrl: "https://img.url" });
    expect(cards[1].imageUrl).toBeNull();
  });

  it("returns empty array when cards field is missing in response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({})
      })
    );

    const cards = await fetchCardsBySet("empty-set");

    expect(cards).toHaveLength(0);
  });

  it("throws when API returns non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(fetchCardsBySet("unknown-set")).rejects.toThrow("tcgdex request failed with status 404");
  });
});
