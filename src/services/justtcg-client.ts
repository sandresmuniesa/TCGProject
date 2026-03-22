import { JustTCG, type Card } from "justtcg-js";
import type { PriceCacheRow } from "@/db/schema";
import type { RemotePrice } from "@/services/types";

export type JustTcgPriceLookupParams = {
  cardId?: string;
  setId?: string;
  cardNumber?: string;
  cardName?: string;
};

// Initialize JustTCG client (reads JUSTTCG_API_KEY from environment automatically)
let clientInstance: JustTCG | null = null;

function getClient(): JustTCG {
  if (!clientInstance) {
    const apiKey = process.env.EXPO_PUBLIC_JUSTTCG_API_KEY;
    if (apiKey) {
      clientInstance = new JustTCG({ apiKey });
    } else {
      clientInstance = new JustTCG();
    }
  }
  return clientInstance;
}

function pickBestVariant(card: Card) {
  if (!card.variants || card.variants.length === 0) {
    return null;
  }

  // Prefer Near Mint Normal print for a representative price
  const nmNormal = card.variants.find(
    (v) => v.condition === "Near Mint" && v.printing === "Normal" && v.price != null
  );

  if (nmNormal) return nmNormal;

  // Fallback: any variant with a price
  return card.variants.find((v) => v.price != null) ?? null;
}

export async function fetchCardPrice(params: JustTcgPriceLookupParams): Promise<RemotePrice> {
  const client = getClient();

  const response = await client.v1.cards.get({
    game: "Pokemon",
    ...(params.cardName && { query: params.cardName }),
    ...(params.cardNumber && { number: params.cardNumber }),
    // NOTE: setId is a TCGDex ID and does NOT match JustTCG set IDs — omitted intentionally
    limit: 5,
    condition: ["NM", "LP"],
  });

  if (response.error) {
    throw new Error(`JustTCG API error: ${response.error} (${response.code})`);
  }

  const cards = response.data as Card[];

  if (!cards || cards.length === 0) {
    throw new Error(`No card found for params: ${JSON.stringify(params)}`);
  }

  const card = cards[0];
  const variant = pickBestVariant(card);

  if (!variant) {
    throw new Error(`No pricing data available for card "${card.name}" (${card.id})`);
  }

  return {
    cardId: params.cardId || card.id,
    currentPriceUsd: variant.price,
    previousPriceUsd: null, // previous price is managed by price-sync from cache
    fetchedAt: new Date(),
  };
}

export function mapRemotePriceToRow(price: RemotePrice): PriceCacheRow {
  return {
    cardId: price.cardId,
    currentPriceUsd: price.currentPriceUsd,
    previousPriceUsd: price.previousPriceUsd ?? null,
    fetchedAt: price.fetchedAt
  };
}