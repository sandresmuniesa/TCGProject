import { JustTCG, type Card } from "justtcg-js";
import type { PriceCacheRow } from "@/db/schema";
import type { CardCondition } from "@/constants/card-condition";
import type { RemotePrice } from "@/services/types";

export type JustTcgPriceLookupParams = {
  cardId?: string;
  setId?: string;
  setName?: string;
  condition?: CardCondition;
  cardNumber?: string;
  cardName?: string;
};

const JUST_TCG_CONDITION_BY_CARD_CONDITION: Record<CardCondition, "NM" | "LP" | "MP" | "HP" | "DMG"> = {
  "Near Mint": "NM",
  "Lightly Played": "LP",
  "Moderately Played": "MP",
  "Heavily Played": "HP",
  Damaged: "DMG"
};

export class JustTcgNoMatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JustTcgNoMatchError";
  }
}

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

function normalizeText(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeNumber(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function hasSubstringMatch(left: string, right: string) {
  if (!left || !right) {
    return false;
  }

  return left.includes(right) || right.includes(left);
}

function pickBestCard(cards: Card[], params: JustTcgPriceLookupParams) {
  const requestedNameRaw = (params.cardName ?? "").trim();
  const requestedName = normalizeText(params.cardName);
  const requestedSetName = normalizeText(params.setName);
  const requestedNumber = normalizeNumber(params.cardNumber);

  const scored = cards
    .map((card) => {
      let score = 0;
      const cardNameRaw = card.name ?? "";
      const cardNameNormalized = normalizeText(card.name);
      const cardNumber = normalizeNumber(card.number);
      const cardSetName = normalizeText(card.set_name);

      if (requestedNumber && cardNumber === requestedNumber) {
        score += 300;
      }

      if (requestedNameRaw && cardNameRaw.toLowerCase() === requestedNameRaw.toLowerCase()) {
        score += 200;
      }

      if (requestedName && cardNameNormalized === requestedName) {
        score += 120;
      }

      if (requestedName && cardNameNormalized.includes(requestedName)) {
        score += 40;
      }

      if (requestedSetName && cardSetName === requestedSetName) {
        score += 500;
      } else if (requestedSetName && hasSubstringMatch(requestedSetName, cardSetName)) {
        score += 220;
      }

      return { card, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0 || scored[0].score <= 0) {
    throw new JustTcgNoMatchError(`No matching card found for params: ${JSON.stringify(params)}`);
  }

  return scored[0].card;
}

export async function fetchCardPrice(params: JustTcgPriceLookupParams): Promise<RemotePrice> {
  if (!params.cardNumber && !params.cardName) {
    throw new JustTcgNoMatchError("Price lookup requires cardNumber or cardName.");
  }

  const client = getClient();
  const requestedCondition = params.condition ? JUST_TCG_CONDITION_BY_CARD_CONDITION[params.condition] : null;

  const response = await client.v1.cards.get({
    game: "Pokemon",
    ...(params.cardName && { query: params.cardName }),
    ...(params.cardNumber && { number: params.cardNumber }),
    // NOTE: setId is a TCGDex ID and does NOT match JustTCG set IDs — omitted intentionally
    limit: 20,
    condition: requestedCondition ? [requestedCondition] : ["NM", "LP"],
  });

  if (response.error) {
    throw new Error(`JustTCG API error: ${response.error} (${response.code})`);
  }

  const cards = response.data as Card[];

  if (!cards || cards.length === 0) {
    throw new JustTcgNoMatchError(`No card found for params: ${JSON.stringify(params)}`);
  }

  const card = pickBestCard(cards, params);
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