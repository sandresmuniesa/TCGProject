import type { CardCondition } from "@/constants/card-condition";
import type { JustTcgPriceLookupParams } from "@/services/justtcg-client";
import type { RemoteCard } from "@/services/types";

export type CatalogCardForMatching = Pick<RemoteCard, "id" | "setId" | "number" | "name"> & {
  setName?: string;
  condition?: CardCondition;
};

function normalizeCardNumber(value: string) {
  return value.trim();
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
  const rawNumber = normalizeCardNumber(card.number);
  const normalizedNumber = rawNumber.toLowerCase();
  const normalizedName = normalizeCardName(card.name);

  const candidates: JustTcgPriceLookupParams[] = [
    { cardId: card.id, setId: card.setId, setName: card.setName, condition: card.condition, cardNumber: rawNumber, cardName: card.name },
    { cardId: card.id, setId: card.setId, setName: card.setName, condition: card.condition, cardNumber: rawNumber, cardName: normalizedName },
    { cardId: card.id, setId: card.setId, setName: card.setName, condition: card.condition, cardNumber: rawNumber },
    { cardId: card.id, setId: card.setId, setName: card.setName, condition: card.condition, cardName: card.name },
    { cardId: card.id, setId: card.setId, setName: card.setName, condition: card.condition, cardName: normalizedName }
  ];

  if (normalizedNumber !== rawNumber) {
    candidates.push(
      { cardId: card.id, setId: card.setId, setName: card.setName, condition: card.condition, cardNumber: normalizedNumber, cardName: card.name },
      { cardId: card.id, setId: card.setId, setName: card.setName, condition: card.condition, cardNumber: normalizedNumber, cardName: normalizedName },
      { cardId: card.id, setId: card.setId, setName: card.setName, condition: card.condition, cardNumber: normalizedNumber }
    );
  }

  const unique = new Map<string, JustTcgPriceLookupParams>();

  for (const candidate of candidates) {
    unique.set(JSON.stringify(candidate), candidate);
  }

  return Array.from(unique.values());
}
