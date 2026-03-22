import type { CardRow, SetRow } from "@/db/schema";
import type { RemoteCard, RemoteSet } from "@/services/types";

const TCGDEX_BASE_URL = "https://api.tcgdex.net/v2/en";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${TCGDEX_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`tcgdex request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchSets(): Promise<RemoteSet[]> {
  const data = await fetchJson<{ id: string; name: string; logo?: string; cardCount?: { total?: number } }[]>("/sets");
  return data.map((set) => ({
    id: set.id,
    name: set.name,
    logoUrl: set.logo ?? null,
    totalCards: set.cardCount?.total ?? 0
  }));
}

export async function fetchCardsBySet(setId: string): Promise<RemoteCard[]> {
  const data = await fetchJson<{ cards?: { id: string; localId: string; name: string; image?: string }[] }>(`/sets/${setId}`);
  const cards = data.cards ?? [];

  return cards.map((card) => ({
    id: card.id,
    setId,
    number: card.localId,
    name: card.name,
    imageUrl: card.image ?? null
  }));
}

export function mapRemoteSetToRow(set: RemoteSet, fetchedAt = new Date()): SetRow {
  return {
    id: set.id,
    name: set.name,
    logoUrl: set.logoUrl ?? null,
    totalCards: set.totalCards ?? 0,
    fetchedAt
  };
}

export function mapRemoteCardToRow(card: RemoteCard, fetchedAt = new Date()): CardRow {
  return {
    id: card.id,
    setId: card.setId,
    number: card.number,
    name: card.name,
    imageUrl: card.imageUrl ?? null,
    fetchedAt
  };
}