import { describe, expect, it, vi } from "vitest";

import { PriceSyncError } from "@/services/price-sync";
import { syncCardPriceWithMatching } from "@/services/price-matching";

describe("syncCardPriceWithMatching", () => {
  it("tries next lookup candidate when first one fails with 404", async () => {
    const buildLookupCandidates = vi.fn().mockReturnValue([
      { cardId: "gym1-1" },
      { setId: "gym1", cardNumber: "1" }
    ]);

    const syncCardPrice = vi
      .fn()
      .mockRejectedValueOnce(new PriceSyncError("no cache", new Error("JustTCG request failed with status 404")))
      .mockResolvedValueOnce({
        source: "remote",
        price: {
          cardId: "gym1-1",
          currentPriceUsd: 22,
          previousPriceUsd: 20,
          fetchedAt: new Date("2026-03-21T10:00:00.000Z")
        }
      });

    const result = await syncCardPriceWithMatching(
      {
        id: "gym1-1",
        setId: "gym1",
        number: "1",
        name: "Blaine's Moltres"
      },
      {
        buildLookupCandidates,
        syncCardPrice
      }
    );

    expect(syncCardPrice).toHaveBeenCalledTimes(2);
    expect(result.lookupUsed).toEqual({ setId: "gym1", cardNumber: "1" });
    expect(result.price.currentPriceUsd).toBe(22);
  });

  it("fails fast when error is not recoverable for matching", async () => {
    const buildLookupCandidates = vi.fn().mockReturnValue([{ cardId: "gym1-1" }]);
    const syncCardPrice = vi.fn().mockRejectedValue(new PriceSyncError("no cache", new Error("JustTCG network error: timeout")));

    await expect(
      syncCardPriceWithMatching(
        {
          id: "gym1-1",
          setId: "gym1",
          number: "1",
          name: "Blaine's Moltres"
        },
        {
          buildLookupCandidates,
          syncCardPrice
        }
      )
    ).rejects.toBeInstanceOf(PriceSyncError);
  });
});
