import { describe, expect, it, vi } from "vitest";

import type { SetRow } from "@/db/schema";
import type { RemoteSet } from "@/services/types";
import { syncInitialSets } from "@/services/catalog-sync";


function createSetRow(overrides: Partial<SetRow> = {}): SetRow {
  return {
    id: "sv1",
    name: "Scarlet & Violet",
    logoUrl: null,
    totalCards: 258,
    fetchedAt: new Date(),
    ...overrides
  };
}

describe("syncInitialSets", () => {
  it("uses local cache when sets already exist", async () => {
    const getAllSets = vi.fn().mockResolvedValue([createSetRow()]);
    const fetchSets = vi.fn().mockResolvedValue([]);
    const upsertSets = vi.fn().mockResolvedValue(undefined);
    const mapRemoteSetToRow = vi.fn().mockReturnValue(createSetRow());

    const result = await syncInitialSets({
      getAllSets,
      fetchSets,
      upsertSets,
      mapRemoteSetToRow
    });

    expect(result).toEqual({ source: "cache", count: 1 });
    expect(fetchSets).not.toHaveBeenCalled();
    expect(upsertSets).not.toHaveBeenCalled();
    expect(mapRemoteSetToRow).not.toHaveBeenCalled();
  });

  it("fetches and persists sets when local cache is empty", async () => {
    const remoteSets: RemoteSet[] = [
      {
        id: "sv2",
        name: "Paldea Evolved",
        logoUrl: null,
        totalCards: 279
      }
    ];

    const mappedRows = [createSetRow({ id: "sv2", name: "Paldea Evolved", totalCards: 279 })];

    const getAllSets = vi.fn().mockResolvedValue([]);
    const fetchSets = vi.fn().mockResolvedValue(remoteSets);
    const mapRemoteSetToRow = vi.fn().mockReturnValue(mappedRows[0]);
    const upsertSets = vi.fn().mockResolvedValue(undefined);

    const result = await syncInitialSets({
      getAllSets,
      fetchSets,
      upsertSets,
      mapRemoteSetToRow
    });

    expect(result).toEqual({ source: "remote", count: 1 });
    expect(fetchSets).toHaveBeenCalledTimes(1);
    expect(mapRemoteSetToRow).toHaveBeenCalledTimes(1);
    expect(upsertSets).toHaveBeenCalledWith(mappedRows);
  });
});