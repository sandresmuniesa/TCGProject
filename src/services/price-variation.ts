import { Platform } from "react-native";

import { syncCardPrice } from "@/services/price-sync";
import type { JustTcgPriceLookupParams } from "@/services/justtcg-client";

const WEB_INVENTORY_PRICE_SNAPSHOT_KEY_PREFIX = "tcg:inventory:price-snapshot:card:";

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
  updateInventoryPriceSnapshotByCardId: (cardId: string, priceUsd: number, priceTimestamp: Date) => Promise<void>;
};

function writeWebInventoryPriceSnapshot(cardId: string, priceUsd: number, priceTimestamp: Date) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(
    `${WEB_INVENTORY_PRICE_SNAPSHOT_KEY_PREFIX}${cardId}`,
    JSON.stringify({
      cardId,
      priceUsd,
      priceTimestamp
    })
  );
}

async function runRefreshCardPriceWithVariation(
  params: JustTcgPriceLookupParams,
  deps: RefreshCardPriceDeps
): Promise<RefreshCardPriceResult> {
  const priceSyncResult = await deps.syncCardPrice(params);
  const fetchedAt = new Date();

  await deps.updateInventoryPriceSnapshotByCardId(priceSyncResult.price.cardId, priceSyncResult.price.currentPriceUsd, fetchedAt);

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
  deps?: RefreshCardPriceDeps
): Promise<RefreshCardPriceResult> {
  if (deps) {
    return runRefreshCardPriceWithVariation(params, deps);
  }

  if (Platform.OS === "web") {
    return runRefreshCardPriceWithVariation(params, {
      syncCardPrice,
      updateInventoryPriceSnapshotByCardId: async (cardId, priceEur, priceTimestamp) => {
        writeWebInventoryPriceSnapshot(cardId, priceEur, priceTimestamp);
      }
    });
  }

  const { updateInventoryPriceSnapshotByCardId } = await import("@/db/repositories/inventory-repository");

  return runRefreshCardPriceWithVariation(params, {
    syncCardPrice,
    updateInventoryPriceSnapshotByCardId
  });
}