import { describe, expect, it, vi } from "vitest";

import type { CardRow } from "@/db/schema";
import type { RemoteCard } from "@/services/types";
import { syncCardsBySet, syncInitialCardsBySetCatalog } from "@/services/catalog-cards-sync";

function createCardRow(overrides: Partial<CardRow> = {}): CardRow {
  return {
    id: "base1-1",
    setId: "base1",
    number: "1",
    name: "Alakazam",
    imageUrl: null,
    fetchedAt: new Date(),
    ...overrides
  };
}

describe("syncCardsBySet", () => {
  it("uses cache when set cards already exist locally", async () => {
    const getCardsBySet = vi.fn().mockResolvedValue([createCardRow()]);
    const fetchCardsBySet = vi.fn().mockResolvedValue([]);
    const upsertCards = vi.fn().mockResolvedValue(undefined);
    const mapRemoteCardToRow = vi.fn().mockReturnValue(createCardRow());

    const result = await syncCardsBySet("base1", {
      getCardsBySet,
      fetchCardsBySet,
      upsertCards,
      mapRemoteCardToRow
    });

    expect(result).toEqual({ setId: "base1", source: "cache", count: 1 });
    expect(fetchCardsBySet).not.toHaveBeenCalled();
    expect(upsertCards).not.toHaveBeenCalled();
  });

  it("downloads and persists cards when local set cache is empty", async () => {
    const remoteCards: RemoteCard[] = [
      {
        id: "base1-2",
        setId: "base1",
        number: "2",
        name: "Blastoise",
        imageUrl: null
      }
    ];

    const mappedRows = [createCardRow({ id: "base1-2", number: "2", name: "Blastoise" })];

    const getCardsBySet = vi.fn().mockResolvedValue([]);
    const fetchCardsBySet = vi.fn().mockResolvedValue(remoteCards);
    const mapRemoteCardToRow = vi.fn().mockReturnValue(mappedRows[0]);
    const upsertCards = vi.fn().mockResolvedValue(undefined);

    const result = await syncCardsBySet("base1", {
      getCardsBySet,
      fetchCardsBySet,
      upsertCards,
      mapRemoteCardToRow
    });

    expect(result).toEqual({ setId: "base1", source: "remote", count: 1 });
    expect(fetchCardsBySet).toHaveBeenCalledWith("base1");
    expect(mapRemoteCardToRow).toHaveBeenCalledTimes(1);
    expect(upsertCards).toHaveBeenCalledWith(mappedRows);
  });
});

describe("syncInitialCardsBySetCatalog", () => {
  it("aggregates sync results across all known sets", async () => {
    const getKnownSetIds = vi.fn().mockResolvedValue(["base1", "base2"]);
    const getCardsBySet = vi
      .fn()
      .mockImplementation(async (setId: string) => (setId === "base1" ? [createCardRow()] : []));
    const fetchCardsBySet = vi.fn().mockResolvedValue([
      {
        id: "base2-1",
        setId: "base2",
        number: "1",
        name: "Chansey",
        imageUrl: null
      }
    ]);
    const mapRemoteCardToRow = vi.fn().mockReturnValue(createCardRow({ id: "base2-1", setId: "base2", name: "Chansey" }));
    const upsertCards = vi.fn().mockResolvedValue(undefined);

    const result = await syncInitialCardsBySetCatalog({
      getKnownSetIds,
      getCardsBySet,
      fetchCardsBySet,
      mapRemoteCardToRow,
      upsertCards
    });

    expect(result).toEqual({
      setCount: 2,
      cachedSetCount: 1,
      downloadedSetCount: 1,
      cardCount: 2
    });
  });
});