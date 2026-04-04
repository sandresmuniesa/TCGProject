import { getCatalogSetOptions, type CatalogSetOption } from "@/services/catalog-sets-query";
import { searchCatalogCards, type CatalogCardSearchResult } from "@/services/catalog-query";
import { getInventoryOverview } from "@/services/inventory-query";

export type CatalogExplorerSet = CatalogSetOption & {
  ownedCardsCount: number;
  ownedQuantity: number;
};

export type CatalogExplorerSetFilterParams = {
  term?: string;
};

export type CatalogSetCardsWithOwnershipParams = {
  setId: string;
  term?: string;
};

export type CatalogCardWithOwnership = CatalogCardSearchResult & {
  isOwned: boolean;
  ownedQuantity: number;
  inventoryIds: string[];
};

type CatalogExplorerDeps = {
  getCatalogSetOptions: typeof getCatalogSetOptions;
  searchCatalogCards: typeof searchCatalogCards;
  getInventoryOverview: typeof getInventoryOverview;
};

const defaultDeps: CatalogExplorerDeps = {
  getCatalogSetOptions,
  searchCatalogCards,
  getInventoryOverview
};

const CARD_NUMBER_COLLATOR = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base"
});

export function filterCatalogExplorerSets(sets: CatalogExplorerSet[], params: CatalogExplorerSetFilterParams) {
  const normalizedTerm = params.term?.trim().toLowerCase() ?? "";

  if (!normalizedTerm) {
    return sets;
  }

  return sets.filter((set) => set.name.toLowerCase().includes(normalizedTerm));
}

export async function getCatalogExplorerSets(deps: CatalogExplorerDeps = defaultDeps): Promise<CatalogExplorerSet[]> {
  const [sets, inventory] = await Promise.all([deps.getCatalogSetOptions(), deps.getInventoryOverview()]);
  const ownershipBySetId = new Map<string, { cardIds: Set<string>; quantity: number }>();

  for (const item of inventory.items) {
    const current = ownershipBySetId.get(item.setId) ?? {
      cardIds: new Set<string>(),
      quantity: 0
    };

    current.cardIds.add(item.cardId);
    current.quantity += item.quantity;
    ownershipBySetId.set(item.setId, current);
  }

  return sets.map((set) => {
    const ownership = ownershipBySetId.get(set.id);

    return {
      id: set.id,
      name: set.name,
      ownedCardsCount: ownership?.cardIds.size ?? 0,
      ownedQuantity: ownership?.quantity ?? 0
    };
  });
}

export async function getCatalogSetCardsWithOwnership(
  params: CatalogSetCardsWithOwnershipParams,
  deps: CatalogExplorerDeps = defaultDeps
): Promise<CatalogCardWithOwnership[]> {
  const [cards, inventory] = await Promise.all([
    deps.searchCatalogCards({ setId: params.setId, term: params.term }),
    deps.getInventoryOverview()
  ]);

  // Aggregate ownership across ALL collections for each card in this set.
  const inventoryByCardId = new Map<string, { quantity: number; inventoryIds: string[] }>();

  for (const item of inventory.items) {
    if (item.setId !== params.setId) {
      continue;
    }

    const current = inventoryByCardId.get(item.cardId) ?? { quantity: 0, inventoryIds: [] };
    current.quantity += item.quantity;
    current.inventoryIds.push(item.inventoryId);
    inventoryByCardId.set(item.cardId, current);
  }

  return cards
    .map((card) => {
      const ownership = inventoryByCardId.get(card.id);

      return {
        ...card,
        isOwned: ownership != null,
        ownedQuantity: ownership?.quantity ?? 0,
        inventoryIds: ownership?.inventoryIds ?? []
      };
    })
    .sort((a, b) => {
      const byNumber = CARD_NUMBER_COLLATOR.compare(a.number, b.number);

      if (byNumber !== 0) {
        return byNumber;
      }

      return a.name.localeCompare(b.name);
    });
}