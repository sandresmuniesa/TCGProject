import { Platform } from "react-native";

const WEB_SETS_CACHE_KEY = "tcg:catalog:sets:v1";
const WEB_SET_CARDS_CACHE_KEY_PREFIX = "tcg:catalog:cards:set:v2:";

export type CatalogSearchParams = {
  term?: string;
  setId?: string;
  setIds?: string[];
};

export type CatalogCardSearchResult = {
  id: string;
  setId: string;
  number: string;
  name: string;
  imageUrl?: string | null;
};

type CatalogSearchDeps = {
  platformOS: string;
  searchNativeCards: (params: CatalogSearchParams) => Promise<CatalogCardSearchResult[]>;
  readWebSetIds: () => string[];
  readWebCardsBySetId: (setId: string) => CatalogCardSearchResult[];
};

function readWebCacheArray<T>(key: string): T[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const defaultDeps: CatalogSearchDeps = {
  platformOS: Platform.OS,
  searchNativeCards: async (params) => {
    const { searchCatalogCards } = await import("@/db/repositories/catalog-repository");
    const rows = await searchCatalogCards(params);

    return rows.map((row) => ({
      id: row.id,
      setId: row.setId,
      number: row.number,
      name: row.name,
      imageUrl: row.imageUrl ?? null
    }));
  },
  readWebSetIds: () => {
    const sets = readWebCacheArray<{ id: string }>(WEB_SETS_CACHE_KEY);
    return sets.map((set) => set.id);
  },
  readWebCardsBySetId: (setId) => readWebCacheArray<CatalogCardSearchResult>(`${WEB_SET_CARDS_CACHE_KEY_PREFIX}${setId}`)
};

function sortCatalogCards(cards: CatalogCardSearchResult[]) {
  return cards.sort((a, b) => {
    const byName = a.name.localeCompare(b.name);

    if (byName !== 0) {
      return byName;
    }

    return a.number.localeCompare(b.number);
  });
}

function filterCards(cards: CatalogCardSearchResult[], params: CatalogSearchParams) {
  const normalizedTerm = params.term?.trim().toLowerCase();
  const activeSetIds = params.setIds && params.setIds.length > 0 ? new Set(params.setIds) : params.setId ? new Set([params.setId]) : null;

  return cards.filter((card) => {
    if (activeSetIds && !activeSetIds.has(card.setId)) {
      return false;
    }

    if (!normalizedTerm) {
      return true;
    }

    return card.name.toLowerCase().includes(normalizedTerm) || card.number.toLowerCase().includes(normalizedTerm);
  });
}

export async function searchCatalogCards(params: CatalogSearchParams, deps: CatalogSearchDeps = defaultDeps) {
  if (deps.platformOS !== "web") {
    return deps.searchNativeCards(params);
  }

  const activeSetIds = params.setIds && params.setIds.length > 0 ? params.setIds : params.setId ? [params.setId] : null;
  const setIds = activeSetIds ?? deps.readWebSetIds();
  const cards = setIds.flatMap((setId) => deps.readWebCardsBySetId(setId));

  return sortCatalogCards(filterCards(cards, params));
}