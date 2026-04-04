import { Platform } from "react-native";

import { syncCardPrice } from "@/services/price-sync";
import type { JustTcgPriceLookupParams } from "@/services/justtcg-client";

export function calculatePriceVariationPercent(previousPriceUsd?: number | null, currentPriceUsd?: number | null) {
  if (
    previousPriceUsd == null ||
    currentPriceUsd == null ||
    !Number.isFinite(previousPriceUsd) ||
    !Number.isFinite(currentPriceUsd) ||
    previousPriceUsd <= 0
  ) {
    return null;
  }

  return ((currentPriceUsd - previousPriceUsd) / previousPriceUsd) * 100;
}

export type RefreshCardPriceResult = {
  source: "remote" | "cache";
  cardId: string;
  currentPriceUsd: number;
  previousPriceUsd?: number | null;
  variationPercent: number | null;
  fetchedAt: Date;
};

type RefreshCardPriceDeps = {
  syncCardPrice: typeof syncCardPrice;
};

async function runRefreshCardPriceWithVariation(
  params: JustTcgPriceLookupParams,
  deps: RefreshCardPriceDeps
): Promise<RefreshCardPriceResult> {
  const priceSyncResult = await deps.syncCardPrice(params);
  const fetchedAt = new Date();

  return {
    source: priceSyncResult.source,
    cardId: priceSyncResult.price.cardId,
    currentPriceUsd: priceSyncResult.price.currentPriceUsd,
    previousPriceUsd: priceSyncResult.price.previousPriceUsd ?? null,
    variationPercent: calculatePriceVariationPercent(
      priceSyncResult.price.previousPriceUsd ?? null,
      priceSyncResult.price.currentPriceUsd
    ),
    fetchedAt
  };
}

export async function refreshCardPriceWithVariation(
  params: JustTcgPriceLookupParams,
  deps: RefreshCardPriceDeps = { syncCardPrice }
): Promise<RefreshCardPriceResult> {
  return runRefreshCardPriceWithVariation(params, deps);
}