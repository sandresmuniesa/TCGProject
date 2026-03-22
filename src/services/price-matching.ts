import { buildJustTcgLookupCandidates, type CatalogCardForMatching } from "@/services/card-matching";
import { PriceSyncError, syncCardPrice, type CardPriceSyncResult } from "@/services/price-sync";
import type { JustTcgPriceLookupParams } from "@/services/justtcg-client";

export type PriceMatchingResult = CardPriceSyncResult & {
  lookupUsed: JustTcgPriceLookupParams;
};

type PriceMatchingDeps = {
  buildLookupCandidates: typeof buildJustTcgLookupCandidates;
  syncCardPrice: typeof syncCardPrice;
};

const defaultDeps: PriceMatchingDeps = {
  buildLookupCandidates: buildJustTcgLookupCandidates,
  syncCardPrice
};

function shouldTryNextCandidate(error: unknown) {
  if (!(error instanceof PriceSyncError)) {
    return false;
  }

  const cause = error.cause;

  if (!(cause instanceof Error)) {
    return false;
  }

  return cause.message.includes("status 400") || cause.message.includes("status 404");
}

export async function syncCardPriceWithMatching(
  card: CatalogCardForMatching,
  deps: PriceMatchingDeps = defaultDeps
): Promise<PriceMatchingResult> {
  const candidates = deps.buildLookupCandidates(card);
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const syncResult = await deps.syncCardPrice(candidate);

      return {
        ...syncResult,
        lookupUsed: candidate
      };
    } catch (error) {
      lastError = error;

      if (!shouldTryNextCandidate(error)) {
        throw error;
      }
    }
  }

  throw new PriceSyncError("No se pudo resolver matching tcgdex-JustTCG para la carta.", lastError);
}
