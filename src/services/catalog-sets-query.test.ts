import { describe, expect, it, vi } from "vitest";

import { getCatalogSetOptions } from "@/services/catalog-sets-query";

describe("getCatalogSetOptions", () => {
  it("returns sorted sets from web cache", async () => {
    const result = await getCatalogSetOptions({
      platformOS: "web",
      getNativeSets: vi.fn(),
      readWebSets: vi.fn().mockReturnValue([
        { id: "sv3", name: "Obsidian Flames" },
        { id: "sv1", name: "Base Set" }
      ])
    });

    expect(result).toEqual([
      { id: "sv1", name: "Base Set" },
      { id: "sv3", name: "Obsidian Flames" }
    ]);
  });

  it("returns sorted sets from native repository", async () => {
    const getNativeSets = vi.fn().mockResolvedValue([
      { id: "sv2", name: "Paldea Evolved" },
      { id: "sv1", name: "Base Set" }
    ]);

    const result = await getCatalogSetOptions({
      platformOS: "ios",
      getNativeSets,
      readWebSets: vi.fn()
    });

    expect(getNativeSets).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      { id: "sv1", name: "Base Set" },
      { id: "sv2", name: "Paldea Evolved" }
    ]);
  });
});