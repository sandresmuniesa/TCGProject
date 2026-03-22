import type { JustTcgPriceLookupParams } from "@/services/justtcg-client";
import type { RemoteCard } from "@/services/types";

export type CatalogCardForMatching = Pick<RemoteCard, "id" | "setId" | "number" | "name">;

function normalizeCardNumber(value: string) {
  return value.trim().toLowerCase();
}

function normalizeCardName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildJustTcgLookupCandidates(card: CatalogCardForMatching): JustTcgPriceLookupParams[] {
  const normalizedNumber = normalizeCardNumber(card.number);
  const normalizedName = normalizeCardName(card.name);

  const candidates: JustTcgPriceLookupParams[] = [
    { cardId: card.id },
    { setId: card.setId, cardNumber: normalizedNumber },
    { setId: card.setId, cardNumber: normalizedNumber, cardName: card.name },
    { setId: card.setId, cardName: card.name },
    { setId: card.setId, cardName: normalizedName }
  ];

  const unique = new Map<string, JustTcgPriceLookupParams>();

  for (const candidate of candidates) {
    unique.set(JSON.stringify(candidate), candidate);
  }

  return Array.from(unique.values());
}
