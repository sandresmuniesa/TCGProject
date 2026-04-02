import { Platform } from "react-native";

import type { PriceCacheRow } from "@/db/schema";
import { fetchCardPrice, mapRemotePriceToRow, type JustTcgPriceLookupParams } from "@/services/justtcg-client";

const WEB_PRICE_CACHE_KEY_PREFIX = "tcg:price:card:";

export type CardPriceSyncResult = {
  source: "remote" | "cache";
  price: PriceCacheRow;
};

export class PriceSyncError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "PriceSyncError";
  }
}

type PriceSyncDeps = {
  fetchCardPrice: typeof fetchCardPrice;
  mapRemotePriceToRow: typeof mapRemotePriceToRow;
  getPriceCache: (cardId: string) => Promise<PriceCacheRow | null>;
  upsertPriceCache: (entry: PriceCacheRow) => Promise<void>;
};

function getWebPriceCacheKey(cardId: string) {
  return `${WEB_PRICE_CACHE_KEY_PREFIX}${cardId}`;
}

function readWebPriceCache(cardId: string) {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  const rawValue = window.localStorage.getItem(getWebPriceCacheKey(cardId));

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PriceCacheRow;
  } catch {
    return null;
  }
}

function writeWebPriceCache(entry: PriceCacheRow) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(getWebPriceCacheKey(entry.cardId), JSON.stringify(entry));
}

async function runNativePriceSync(params: JustTcgPriceLookupParams, deps: PriceSyncDeps): Promise<CardPriceSyncResult> {
  const cache = params.cardId ? await deps.getPriceCache(params.cardId) : null;

  try {
    const remotePrice = await deps.fetchCardPrice(params);
    const mapped = deps.mapRemotePriceToRow(remotePrice);

    // Preserve last stored value as previous price to keep comparison continuity.
    const persisted: PriceCacheRow = {
      ...mapped,
      previousPriceUsd: cache?.currentPriceUsd ?? mapped.previousPriceUsd ?? null,
      fetchedAt: new Date()
    };

    try {
      await deps.upsertPriceCache(persisted);
    } catch {
      // A cache write failure (e.g. FK violation when cardId is a JustTCG ID)
      // must not prevent the fetched price from being returned to the caller.
    }

    return {
      source: "remote",
      price: persisted
    };
  } catch (error) {
    if (cache) {
      return {
        source: "cache",
        price: cache
      };
    }

    throw new PriceSyncError("No fue posible obtener precio desde JustTCG ni usar cache local.", error);
  }
}

async function runWebPriceSync(params: JustTcgPriceLookupParams): Promise<CardPriceSyncResult> {
  const cache = params.cardId ? readWebPriceCache(params.cardId) : null;

  try {
    const remotePrice = await fetchCardPrice(params);
    const mapped = mapRemotePriceToRow(remotePrice);
    const persisted: PriceCacheRow = {
      ...mapped,
      previousPriceUsd: cache?.currentPriceUsd ?? mapped.previousPriceUsd ?? null,
      fetchedAt: new Date()
    };

    writeWebPriceCache(persisted);

    return {
      source: "remote",
      price: persisted
    };
  } catch (error) {
    if (cache) {
      return {
        source: "cache",
        price: cache
      };
    }

    throw new PriceSyncError("No fue posible obtener precio desde JustTCG ni usar cache local.", error);
  }
}

export async function syncCardPrice(
  params: JustTcgPriceLookupParams,
  deps?: PriceSyncDeps
): Promise<CardPriceSyncResult> {
  if (deps) {
    return runNativePriceSync(params, deps);
  }

  if (Platform.OS === "web") {
    return runWebPriceSync(params);
  }

  const { getPriceCache, upsertPriceCache } = await import("@/db/repositories/price-cache-repository");

  return runNativePriceSync(params, {
    fetchCardPrice,
    mapRemotePriceToRow,
    getPriceCache,
    upsertPriceCache
  });
}